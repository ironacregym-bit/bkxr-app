"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import useSWR, { mutate } from "swr";
import { useSession, signIn } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import MacrosCard, {
  type MacroGoals,
  type MacroProgress,
  type MacroTotals,
} from "../components/nutrition/MacrosCard";
import FoodEditor, { type Food } from "../components/nutrition/FoodEditor";
import BarcodeScannerGate from "../components/nutrition/BarcodeScannerGate";
import BarcodeScannerClient from "../components/nutrition/BarcodeScannerClient";
import GlobalNumericFocus from "../components/GlobalNumericFocus";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const meals = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;

const COLORS = {
  calories: "#ff7f32",
  protein: "#32ff7f",
  carbs: "#ffc107",
  fat: "#ff4fa3",
};

const ACCENT = "#ff8a2a"; // neon orange

function round2(n: number | undefined | null) {
  return n !== undefined && n !== null ? Number(n).toFixed(2) : "-";
}
function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function dayMinus(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(d.getDate() - days);
  return x;
}
function yesterday(d: Date) {
  return dayMinus(d, 1);
}

type NutritionEntry = {
  id: string;
  created_at?: string | number;
  date: string;
  meal: string;
  food: Food;
  grams?: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type LogsResponse = { entries: NutritionEntry[] };

type UserProfile = {
  caloric_target?: number;
  protein_target?: number;
  carb_target?: number;
  fat_target?: number;
  subscription_status?:
    | "active"
    | "trialing"
    | "canceled"
    | "incomplete"
    | "past_due"
    | string
    | null;
  membership_status?: "gym_member" | "none" | string | null;
  email?: string;
};

export default function NutritionPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [openMeal, setOpenMeal] = useState<string | null>(null);

  // Date navigation
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  useEffect(() => {
    if (router.query.date) {
      const parsed = new Date(router.query.date as string);
      if (!isNaN(parsed.getTime())) setSelectedDate(parsed);
    }
  }, [router.query.date]);

  const formattedDate = useMemo(() => ymd(selectedDate), [selectedDate]);
  const goPrevDay = () => setSelectedDate((d) => dayMinus(d, 1));
  const goNextDay = () => {
    const tomorrow = new Date(selectedDate.getTime() + 86400000);
    if (ymd(tomorrow) <= ymd(new Date())) setSelectedDate(tomorrow);
  };

  // Search + editor state
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<Food[]>([]);
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [usingServing, setUsingServing] =
    useState<"per100" | "serving">("per100");
  const [adding, setAdding] = useState<boolean>(false);

  // A scroll anchor so editor moves into view when a food is selected
  const editorTopRef = useRef<HTMLDivElement | null>(null);

  // Favourites (localStorage, per-user)
  const [favourites, setFavourites] = useState<Food[]>([]);
  const favKey = useMemo(
    () =>
      session?.user?.email
        ? `bxkr:favs:${session.user.email as string}`
        : `bxkr:favs:anon`,
    [session?.user?.email]
  );

  // Hydration-safe mounted flag for localStorage access
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ---- Favourites load + legacy migration ----
  useEffect(() => {
    if (!mounted) return;
    try {
      const existing = localStorage.getItem(favKey);
      const parsed: Food[] = existing ? JSON.parse(existing) : [];

      // Migrate from legacy key once (non-destructive merge)
      const legacyKey = "bxkr:favs";
      const legacyRaw = localStorage.getItem(legacyKey);
      const legacy: Food[] = legacyRaw ? JSON.parse(legacyRaw) : [];
      let merged = parsed;

      if (legacy.length) {
        const sig = (f: Food) => f.id || f.code || f.name || "";
        const seen = new Set(parsed.map(sig));
        const additions = legacy.filter((f) => !seen.has(sig(f)));
        if (additions.length) {
          merged = [...additions, ...parsed].slice(0, 50);
          try {
            localStorage.setItem(favKey, JSON.stringify(merged));
          } catch {}
        }
        try {
          localStorage.removeItem(legacyKey);
        } catch {}
      }

      setFavourites(merged);
    } catch {
      setFavourites([]);
    }
  }, [favKey, mounted]);

  const isFavourite = (food: Food | null) => {
    if (!food) return false;
    return favourites.some((f) => f.id === food.id || (food.code && f.code === food.code));
  };
  const saveFavourites = (arr: Food[]) => {
    setFavourites(arr);
    try {
      localStorage.setItem(favKey, JSON.stringify(arr));
    } catch {}
  };
  const toggleFavourite = (food: Food) => {
    const exists = isFavourite(food);
    const next = exists
      ? favourites.filter((f) => f.id !== food.id && f.code !== food.code)
      : [{ ...food }, ...favourites].slice(0, 30); // cap to 30
    saveFavourites(next);
  };

  // Scanner gate
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);

  // Logs (for selected date)
  const swrKey = session?.user?.email
    ? `/api/nutrition/logs?date=${formattedDate}`
    : null;
  const { data: logsData } = useSWR<LogsResponse>(swrKey, fetcher);

  // Profile goals
  const { data: profile } = useSWR<UserProfile>(
    session?.user?.email
      ? `/api/profile?email=${encodeURIComponent(
          session.user.email as string
        )}`
      : null,
    fetcher
  );

  const isPremium =
    profile?.subscription_status === "active" ||
    profile?.subscription_status === "trialing" ||
    profile?.membership_status === "gym_member";

  const goals: MacroGoals = {
    calories: profile?.caloric_target || 2000,
    protein: profile?.protein_target || 150,
    carbs: profile?.carb_target || 250,
    fat: profile?.fat_target || 70,
  };

  // Totals
  const totals: MacroTotals = useMemo(() => {
    const entries = logsData?.entries || [];
    return entries.reduce(
      (acc: MacroTotals, e: NutritionEntry) => {
        acc.calories += e.calories || 0;
        acc.protein += e.protein || 0;
        acc.carbs += e.carbs || 0;
        acc.fat += e.fat || 0;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [logsData]);

  const progress: MacroProgress = {
    calories: Math.min(100, (totals.calories / goals.calories) * 100),
    protein: Math.min(100, (totals.protein / goals.protein) * 100),
    carbs: Math.min(100, (totals.carbs / goals.carbs) * 100),
    fat: Math.min(100, (totals.fat / goals.fat) * 100),
  };

  // Debounced search
  function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }
  const doSearch = useMemo(
    () =>
      debounce(async (q: string) => {
        if (!q || q.trim().length < 2) {
          setResults([]);
          setLoadingSearch(false);
          return;
        }
        setLoadingSearch(true);
        try {
          const res = await fetch(
            `/api/foods/search?query=${encodeURIComponent(q)}`
          );
          const json = await res.json();
          setResults((json.foods || []) as Food[]);
        } catch {
          setResults([]);
        } finally {
          setLoadingSearch(false);
        }
      }, 300),
    []
  );
  useEffect(() => {
    doSearch(query);
  }, [query, doSearch]);

  // Scaled macros for non-manual entries (serving/per100 preserved if you still use it)
  const scaledSelected: Food | null = useMemo(() => {
    if (!selectedFood) return null;
    if (selectedFood.id?.startsWith("manual-")) return selectedFood;
    if (usingServing === "serving" && selectedFood.servingSize) {
      const hasPerServing =
        selectedFood.caloriesPerServing != null ||
        selectedFood.proteinPerServing != null ||
        selectedFood.carbsPerServing != null ||
        selectedFood.fatPerServing != null;

      if (hasPerServing) {
        return {
          ...selectedFood,
          calories: +(
            Number(selectedFood.caloriesPerServing ?? 0)
          ).toFixed(2),
          protein: +(Number(selectedFood.proteinPerServing ?? 0)).toFixed(2),
          carbs: +(Number(selectedFood.carbsPerServing ?? 0)).toFixed(2),
          fat: +(Number(selectedFood.fatPerServing ?? 0)).toFixed(2),
        };
      }
    }
    return selectedFood;
  }, [selectedFood, usingServing]);

  // Add entry
  const addEntry = async (meal: string, food: Food | null) => {
    if (!session?.user?.email || !food) return signIn("google");

    const payload: any = {
      date: formattedDate,
      meal,
      food,
      calories: (scaledSelected || food).calories,
      protein: (scaledSelected || food).protein,
      carbs: (scaledSelected || food).carbs,
      fat: (scaledSelected || food).fat,
    };

    setAdding(true);
    try {
      const optimistic = {
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        ...payload,
      };
      mutate(
        swrKey!,
        (data: LogsResponse | undefined) => ({
          entries: [optimistic as NutritionEntry, ...(data?.entries || [])],
        }),
        false
      );

      const res = await fetch("/api/nutrition/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");

      mutate(swrKey!);
      setSelectedFood(null);
      setQuery("");
      setResults([]);
      setUsingServing("per100");
    } finally {
      setAdding(false);
    }
  };

  const removeEntry = async (id: string) => {
    if (!confirm("Remove this entry?")) return;
    await fetch(
      `/api/nutrition/logs?id=${encodeURIComponent(id)}&date=${formattedDate}`,
      { method: "DELETE" }
    );
    mutate(swrKey!);
  };

  // ---------- Day actions: Copy (whole day) / Clear day ----------
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyDate, setCopyDate] = useState<string>(() => ymd(yesterday(selectedDate)));
  useEffect(() => {
    // Reset default copy source when user changes selected date
    setCopyDate(ymd(yesterday(selectedDate)));
  }, [selectedDate]);

  async function copyFromDateKey(sourceKey: string) {
    if (!session?.user?.email) return signIn("google");
    if (!sourceKey) return;

    try {
      setCopyBusy(true);

      if (sourceKey === formattedDate) {
        alert("You can’t copy from the same day.");
        setCopyBusy(false);
        return;
      }

      // Fetch source entries
      const r = await fetch(
        `/api/nutrition/logs?date=${encodeURIComponent(sourceKey)}`
      );
      const j = (await r.json()) as LogsResponse | null;
      const srcEntries = j?.entries || [];
      if (srcEntries.length === 0) {
        alert("No entries found for that date.");
        setCopyBusy(false);
        return;
      }

      // Prevent exact duplicates (same meal + food id/code/name + macros)
      const existingSigs = (logsData?.entries || []).map(
        (e) =>
          `${e.meal}|${e.food?.id || e.food?.code || e.food?.name}|${e.calories}|${e.protein}|${e.carbs}|${e.fat}`
      );
      const toCreate = srcEntries.filter((e) => {
        const sig = `${e.meal}|${
          e.food?.id || e.food?.code || e.food?.name
        }|${e.calories}|${e.protein}|${e.carbs}|${e.fat}`;
        return !existingSigs.includes(sig);
      });

      if (toCreate.length === 0) {
        alert("Everything from that day is already on this date.");
        setCopyBusy(false);
        return;
      }

      // Sequential POSTs with your existing API
      for (const e of toCreate) {
        const payload: any = {
          date: formattedDate,
          meal: e.meal,
          food: e.food,
          calories: Number(e.calories || 0),
          protein: Number(e.protein || 0),
          carbs: Number(e.carbs || 0),
          fat: Number(e.fat || 0),
        };

        const res = await fetch("/api/nutrition/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(
            `Failed to add an entry (${res.status}): ${txt || res.statusText}`
          );
        }
      }

      await mutate(swrKey!);
    } catch (e: any) {
      alert(e?.message || "Failed to copy entries");
    } finally {
      setCopyBusy(false);
    }
  }

  async function clearThisDay() {
    if (!logsData?.entries?.length) {
      alert("There are no entries to clear on this date.");
      return;
    }
    const ok = confirm(
      `Remove all ${logsData.entries.length} entries logged on ${formattedDate}?`
    );
    if (!ok) return;

    // Simple sequential delete using your existing DELETE endpoint
    for (const e of logsData.entries) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await fetch(
          `/api/nutrition/logs?id=${encodeURIComponent(e.id)}&date=${formattedDate}`,
          { method: "DELETE" }
        );
      } catch {
        // continue on error
      }
    }
    mutate(swrKey!);
  }

  // For manual editor: patch function
  const onChangeSelectedFood = (patch: Partial<Food>) => {
    setSelectedFood((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  // ----- UI helpers -----
  function selectFoodForMeal(food: Food, meal: typeof meals[number]) {
    setSelectedFood(food);
    setOpenMeal(meal);

    // Auto-select per serving if available
    const hasPerServing =
      food.caloriesPerServing != null ||
      food.proteinPerServing != null ||
      food.carbsPerServing != null ||
      food.fatPerServing != null;
    setUsingServing(hasPerServing ? "serving" : "per100");

    // Move editor into view on next paint
    requestAnimationFrame(() => {
      editorTopRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  return (
    <>
      {/* Global select-on-focus for number inputs */}
      <GlobalNumericFocus />

      <main
        className="container py-3"
        style={{ paddingBottom: "90px", color: "#fff", borderRadius: "12px" }}
      >
        {/* Date Navigation */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <button className="btn btn-bxkr-outline" onClick={goPrevDay}>
            ← Previous
          </button>
          <h2 className="text-center mb-0" style={{ fontWeight: 700 }}>
            Nutrition ({formattedDate})
          </h2>
          <button
            className="btn btn-bxkr-outline"
            onClick={goNextDay}
            disabled={formattedDate === ymd(new Date())}
          >
            Next →
          </button>
        </div>

        {/* Macros */}
        <MacrosCard totals={totals} goals={goals} progress={progress} />

        {/* ===== Day actions (inline, compact) ===== */}
        <section className="futuristic-card p-3 mb-3">
          {/* Row 1: Datepicker + Copy (single line) */}
          <div
            className="d-flex flex-wrap align-items-end"
            style={{ gap: 8 }}
          >
            <input
              className="form-control"
              type="date"
              value={copyDate}
              onChange={(e) => setCopyDate(e.target.value)}
              max={ymd(new Date())}
              aria-label="Select a date to copy from"
              style={{ minWidth: 175, width: 190 }}
              placeholder="Copy from date"
            />
            <button
              className="btn btn-sm btn-bxkr"
              style={{ borderRadius: 24, height: 38 }}
              onClick={() => copyFromDateKey(copyDate)}
              disabled={copyBusy || !copyDate}
              aria-label={`Copy entries from ${copyDate} to ${formattedDate}`}
              title={`Copy entries from ${copyDate}`}
            >
              {copyBusy ? (
                "Copying…"
              ) : (
                <>
                  <i className="fas fa-copy me-1" aria-hidden="true" />
                  Copy
                </>
              )}
            </button>
          </div>

          {/* Row 2: Copy Yesterday (neon orange outline) + Clear This Day (same line) */}
          <div
            className="d-flex flex-wrap align-items-center mt-2"
            style={{ gap: 8 }}
          >
            <button
              className="btn btn-sm"
              style={{
                borderRadius: 24,
                border: `1px solid ${ACCENT}`,
                color: ACCENT,
                background: "transparent",
                boxShadow: `0 0 10px ${ACCENT}55`,
              }}
              onClick={() => copyFromDateKey(ymd(yesterday(selectedDate)))}
              disabled={copyBusy}
              title={`Copy all entries from ${ymd(yesterday(selectedDate))}`}
            >
              <i className="fas fa-arrow-left me-1" aria-hidden="true" />
              {copyBusy ? "Copying…" : "Copy Yesterday"}
            </button>

            <button
              className="btn btn-sm btn-outline-danger"
              style={{ borderRadius: 24 }}
              onClick={clearThisDay}
              title="Remove all entries on this date"
              disabled={!logsData?.entries?.length}
            >
              <i className="fas fa-trash-alt me-1" aria-hidden="true" />
              Clear This Day
            </button>
          </div>
        </section>

        {/* ===== Meals / Logs ===== */}
        {meals.map((meal) => {
          const mealEntries =
            logsData?.entries?.filter((e) => e.meal === meal) || [];
          const isOpen = openMeal === meal;
          const mealTotals: MacroTotals = mealEntries.reduce(
            (acc: MacroTotals, e: NutritionEntry) => ({
              calories: acc.calories + (e.calories || 0),
              protein: acc.protein + (e.protein || 0),
              carbs: acc.carbs + (e.carbs || 0),
              fat: acc.fat + (e.fat || 0),
            }),
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
          );

          return (
            <div key={meal} className="mb-3">
              <button
                className="btn btn-bxkr-outline w-100 mb-2 text-start"
                style={{ borderRadius: "12px" }}
                onClick={() => setOpenMeal(isOpen ? null : meal)}
              >
                {meal} ({mealEntries.length}) —{" "}
                <span style={{ color: COLORS.calories }}>
                  {round2(mealTotals.calories)} kcal
                </span>{" "}
                |{" "}
                <span style={{ color: COLORS.protein }}>
                  {round2(mealTotals.protein)}p
                </span>{" "}
                |{" "}
                <span style={{ color: COLORS.carbs }}>
                  {round2(mealTotals.carbs)}c
                </span>{" "}
                |{" "}
                <span style={{ color: COLORS.fat }}>
                  {round2(mealTotals.fat)}f
                </span>
              </button>

              {isOpen && (
                <div className="px-2">
                  {/* Anchor used to scroll FoodEditor into view */}
                  <div ref={editorTopRef} />

                  {/* If a food is selected: ONLY show the editor */}
                  {selectedFood ? (
                    <FoodEditor
                      meal={meal}
                      food={selectedFood}
                      usingServing={usingServing}
                      setUsingServing={setUsingServing}
                      scaledSelected={scaledSelected}
                      addEntry={addEntry}
                      isFavourite={isFavourite(selectedFood)}
                      onToggleFavourite={() => toggleFavourite(selectedFood)}
                      onChangeFood={onChangeSelectedFood}
                    />
                  ) : (
                    <>
                      {/* Search */}
                      <div className="d-flex gap-2 mb-2">
                        <input
                          className="form-control"
                          placeholder={`Search foods for ${meal}…`}
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </div>

                      {/* Favourites rail (visible when no item selected) */}
                      {favourites.length > 0 && (
                        <div className="mb-2">
                          <div className="text-dim small mb-1">Your favourites</div>
                          <div className="d-flex flex-wrap" style={{ gap: 8 }}>
                            {favourites.map((f) => (
                              <button
                                key={(f.id || f.code || f.name) + "-fav"}
                                className="btn btn-sm"
                                style={{
                                  borderRadius: 999,
                                  border: `1px solid ${ACCENT}55`,
                                  color: "#fff",
                                  background: "rgba(255,255,255,0.04)",
                                }}
                                onClick={() => selectFoodForMeal(f, meal)}
                                title="Use this favourite"
                              >
                                <i className="fas fa-star me-1" style={{ color: "#ffc107" }} />
                                {f.name || f.code || "Food"}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Results list */}
                      {query.trim().length >= 2 && (
                        <div className="mb-2">
                          {loadingSearch ? (
                            <div className="text-dim small">Searching…</div>
                          ) : results.length === 0 ? (
                            <div className="text-dim small">No foods found.</div>
                          ) : (
                            <div className="d-flex flex-column" style={{ gap: 8 }}>
                              {results.map((food) => (
                                <div
                                  key={(food.id || food.code || food.name) + "-res"}
                                  className="futuristic-card p-2 d-flex align-items-center justify-content-between"
                                >
                                  <div className="me-2">
                                    <div className="fw-semibold" style={{ lineHeight: 1.2 }}>
                                      {food.name || food.code || "Food"}
                                    </div>
                                    <div className="small text-dim">
                                      <span style={{ color: COLORS.calories }}>
                                        {round2(food.calories)} kcal
                                      </span>{" "}
                                      | <span style={{ color: COLORS.protein }}>{round2(food.protein)}p</span>{" "}
                                      | <span style={{ color: COLORS.carbs }}>{round2(food.carbs)}c</span>{" "}
                                      | <span style={{ color: COLORS.fat }}>{round2(food.fat)}f</span>
                                    </div>
                                  </div>
                                  <div className="d-flex align-items-center" style={{ gap: 8 }}>
                                    <button
                                      className="btn btn-sm btn-outline-light"
                                      style={{ borderRadius: 999 }}
                                      onClick={() => toggleFavourite(food)}
                                      title={isFavourite(food) ? "Unfavourite" : "Favourite"}
                                    >
                                      <i
                                        className={
                                          isFavourite(food)
                                            ? "fas fa-star text-warning"
                                            : "far fa-star text-dim"
                                        }
                                      />
                                    </button>
                                    <button
                                      className="btn btn-sm"
                                      style={{
                                        borderRadius: 999,
                                        border: `1px solid ${ACCENT}88`,
                                        color: ACCENT,
                                        background: "transparent",
                                      }}
                                      onClick={() => selectFoodForMeal(food, meal)}
                                    >
                                      Select
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Scanner gate (hidden once an item is selected) */}
                      <BarcodeScannerGate
                        isPremium={Boolean(isPremium)}
                        onScanRequested={() => setScannerOpen(true)}
                      />

                      {/* Logged entries */}
                      {mealEntries.map((e) => (
                        <div
                          key={e.id}
                          className="futuristic-card p-3 mb-2 d-flex justify-content-between align-items-center"
                        >
                          <div>
                            <div className="fw-bold d-flex align-items-center">
                              {e.food.name || "Manual item"}
                              <button
                                type="button"
                                className="btn btn-link p-0 ms-2"
                                onClick={() => toggleFavourite(e.food)}
                                title={
                                  isFavourite(e.food) ? "Unfavourite" : "Favourite"
                                }
                              >
                                <i
                                  className={
                                    isFavourite(e.food)
                                      ? "fas fa-star text-warning"
                                      : "far fa-star text-dim"
                                  }
                                />
                              </button>
                            </div>
                            <div className="small">
                              <span style={{ color: COLORS.calories }}>
                                {round2(e.calories)} kcal
                              </span>{" "}
                              |{" "}
                              <span style={{ color: COLORS.protein }}>
                                {round2(e.protein)}p
                              </span>{" "}
                              |{" "}
                              <span style={{ color: COLORS.carbs }}>
                                {round2(e.carbs)}c
                              </span>{" "}
                              |{" "}
                              <span style={{ color: COLORS.fat }}>
                                {round2(e.fat)}f
                              </span>
                            </div>
                          </div>
                          <button
                            className="btn btn-link text-danger"
                            onClick={() => removeEntry(e.id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* Scanner Modal */}
      <BarcodeScannerClient
        isOpen={scannerOpen && Boolean(isPremium)}
        onClose={() => setScannerOpen(false)}
        onFoundFood={(food) => {
          // When quick-add returns a new item, use it immediately
          setResults([food]);
          setSelectedFood(food);

          // Default to per serving if available
          const hasPerServing =
            food.caloriesPerServing != null ||
            food.proteinPerServing != null ||
            food.carbsPerServing != null ||
            food.fatPerServing != null;
          setUsingServing(hasPerServing ? "serving" : "per100");

          setQuery(food.name || food.code || "");
          setOpenMeal((prev) => prev || "Breakfast");

          // Bring editor into view
          requestAnimationFrame(() => {
            editorTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }}
        onLookupBarcode={async (code: string) => {
          // Use the new lookup endpoint that checks user->global barcode catalogues
          const res = await fetch(
            `/api/foods/lookup-barcode?barcode=${encodeURIComponent(code)}`
          );
          const json = await res.json();
          const found: Food | undefined = (json.foods || [])[0] as Food | undefined;
          if (!found) return undefined;

          setResults([found]);
          setSelectedFood(found);

          const hasPerServing =
            found.caloriesPerServing != null ||
            found.proteinPerServing != null ||
            found.carbsPerServing != null ||
            found.fatPerServing != null;
          setUsingServing(hasPerServing ? "serving" : "per100");

          setQuery(found.name || found.code || "");
          setOpenMeal((prev) => prev || "Breakfast");

          requestAnimationFrame(() => {
            editorTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          });

          return found;
        }}
      />

      <BottomNav />
    </>
  );
}
