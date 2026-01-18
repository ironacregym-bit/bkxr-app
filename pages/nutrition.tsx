
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import useSWR, { mutate } from "swr";
import { useSession, signIn } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import MacrosCard, { type MacroGoals, type MacroProgress, type MacroTotals } from "../components/nutrition/MacrosCard";
import FoodEditor, { type Food } from "../components/nutrition/FoodEditor";
import BarcodeScannerGate from "../components/nutrition/BarcodeScannerGate";
import BarcodeScannerClient from "../components/nutrition/BarcodeScannerClient";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const meals = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;

const COLORS = {
  calories: "#ff7f32",
  protein: "#32ff7f",
  carbs: "#ffc107",
  fat: "#ff4fa3",
};

function round2(n: number | undefined | null) {
  return n !== undefined && n !== null ? Number(n).toFixed(2) : "-";
}

type NutritionEntry = {
  id: string;
  created_at?: string | number;
  date: string;
  meal: string;
  food: Food;
  grams: number;
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
  subscription_status?: "active" | "trialing" | "canceled" | "incomplete" | "past_due" | string | null;
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

  const formattedDate = useMemo(() => selectedDate.toISOString().slice(0, 10), [selectedDate]);
  const goPrevDay = () => setSelectedDate((d) => new Date(d.getTime() - 86400000));
  const goNextDay = () => {
    const tomorrow = new Date(selectedDate.getTime() + 86400000);
    if (tomorrow <= new Date()) setSelectedDate(tomorrow);
  };

  // Search state
  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<Food[]>([]);
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [grams, setGrams] = useState<number>(100);
  const [usingServing, setUsingServing] = useState<"per100" | "serving">("per100");
  const [adding, setAdding] = useState<boolean>(false);

  // Favourites (localStorage, per-user)
  const [favourites, setFavourites] = useState<Food[]>([]);
  const favKey = useMemo(
    () => (session?.user?.email ? `bxkr:favs:${session.user.email as string}` : `bxkr:favs:anon`),
    [session?.user?.email]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(favKey);
      setFavourites(raw ? JSON.parse(raw) : []);
    } catch {
      setFavourites([]);
    }
  }, [favKey]);

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

  // Scanner gate & modal
  const [scannerOpen, setScannerOpen] = useState<boolean>(false);
  const [scannerKey, setScannerKey] = useState(0); // force remount for reliability

  // Logs
  const { data: logsData } = useSWR<LogsResponse>(
    session?.user?.email ? `/api/nutrition/logs?date=${formattedDate}` : null,
    fetcher
  );

  // Profile goals
  const { data: profile } = useSWR<UserProfile>(
    session?.user?.email ? `/api/profile?email=${encodeURIComponent(session.user.email as string)}` : null,
    fetcher
  );

  const isPremium =
    (profile?.subscription_status === "active" || profile?.subscription_status === "trialing") ||
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

  // Debounce search
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
          const res = await fetch(`/api/foods/search?query=${encodeURIComponent(q)}`);
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

  // Utility: extract grams from serving string
  function extractGramAmount(text?: string | null): number | null {
    if (!text) return null;
    const match = text.match(/(\d+(?:\.\d+)?)\s*g/i) || text.match(/\((\d+(?:\.\d+)?)\s*g\)/i);
    return match && match[1] ? Number(match[1]) : null;
  }

  // Compute scaled nutrition for the current selection
  const scaledSelected: Food | null = useMemo(() => {
    if (!selectedFood) return null;

    if (usingServing === "serving" && selectedFood.servingSize) {
      const hasPerServing =
        selectedFood.caloriesPerServing != null ||
        selectedFood.proteinPerServing != null ||
        selectedFood.carbsPerServing != null ||
        selectedFood.fatPerServing != null;

      if (hasPerServing) {
        return {
          ...selectedFood,
          calories: +(Number(selectedFood.caloriesPerServing ?? 0)).toFixed(2),
          protein: +(Number(selectedFood.proteinPerServing ?? 0)).toFixed(2),
          carbs: +(Number(selectedFood.carbsPerServing ?? 0)).toFixed(2),
          fat: +(Number(selectedFood.fatPerServing ?? 0)).toFixed(2),
        };
      }
      const servingGrams = extractGramAmount(selectedFood.servingSize) ?? grams;
      const factor = servingGrams / 100;
      return {
        ...selectedFood,
        calories: +(selectedFood.calories * factor).toFixed(2),
        protein: +(selectedFood.protein * factor).toFixed(2),
        carbs: +(selectedFood.carbs * factor).toFixed(2),
        fat: +(selectedFood.fat * factor).toFixed(2),
      };
    }

    const factor = grams / 100;
    return {
      ...selectedFood,
      calories: +(selectedFood.calories * factor).toFixed(2),
      protein: +(selectedFood.protein * factor).toFixed(2),
      carbs: +(selectedFood.carbs * factor).toFixed(2),
      fat: +(selectedFood.fat * factor).toFixed(2),
    };
  }, [selectedFood, grams, usingServing]);

  const addEntry = async (meal: string, food: Food | null) => {
    if (!session?.user?.email || !food) return signIn("google");
    const chosenGrams = usingServing === "serving" ? extractGramAmount(food.servingSize) ?? grams : grams;

    const payload = {
      date: formattedDate,
      meal,
      food,
      grams: chosenGrams,
      calories: (scaledSelected || food).calories,
      protein: (scaledSelected || food).protein,
      carbs: (scaledSelected || food).carbs,
      fat: (scaledSelected || food).fat,
    };

    setAdding(true);
    try {
      const optimistic = { id: `temp-${Date.now()}`, created_at: new Date().toISOString(), ...payload };
      mutate(
        `/api/nutrition/logs?date=${formattedDate}`,
        (data: LogsResponse | undefined) => ({ entries: [optimistic as NutritionEntry, ...(data?.entries || [])] }),
        false
      );

      const res = await fetch("/api/nutrition/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");

      mutate(`/api/nutrition/logs?date=${formattedDate}`);
      setSelectedFood(null);
      setQuery("");
      setResults([]);
      setGrams(100);
      setUsingServing("per100");
    } finally {
      setAdding(false);
    }
  };

  const removeEntry = async (id: string) => {
    if (!confirm("Remove this entry?")) return;
    await fetch(`/api/nutrition/logs?id=${encodeURIComponent(id)}&date=${formattedDate}`, { method: "DELETE" });
    mutate(`/api/nutrition/logs?date=${formattedDate}`);
  };

  // Scanner lookup (preserves your API)
  async function handleBarcodeLookup(code: string) {
    const res = await fetch(`/api/foods/search?barcode=${encodeURIComponent(code)}`);
    const json = await res.json();
    const found: Food | undefined = (json.foods || [])[0] as Food | undefined;
    if (!found) return undefined;
    setResults([found]);
    setSelectedFood(found);
    setQuery(found.name || found.code || "");
    setUsingServing("per100");
    const g = extractGramAmount(found.servingSize);
    setGrams(g ?? 100);
    setOpenMeal((prev) => prev || "Breakfast");
    return found;
  }

  return (
    <>
      <main className="container py-3" style={{ paddingBottom: "90px", color: "#fff", borderRadius: "12px" }}>
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
            disabled={formattedDate === new Date().toISOString().slice(0, 10)}
          >
            Next →
          </button>
        </div>

        {/* Macros */}
        <MacrosCard totals={totals} goals={goals} progress={progress} />

        {/* Meals */}
        {meals.map((meal) => {
          const mealEntries = logsData?.entries?.filter((e) => e.meal === meal) || [];
          const isOpen = openMeal === meal;
          const mealTotals = mealEntries.reduce(
            (acc: MacroTotals, e: NutritionEntry) => {
              acc.calories += e.calories || 0;
              acc.protein += e.protein || 0;
              acc.carbs += e.carbs || 0;
              acc.fat += e.fat || 0;
              return acc;
            },
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
          );

          const favouriteStrip =
            favourites.length > 0 && (
              <div className="mb-2" style={{ overflowX: "auto", whiteSpace: "nowrap" }}>
                {favourites.map((fav) => (
                  <button
                    key={fav.id ?? fav.code ?? fav.name}
                    className="bxkr-pill me-1"
                    onClick={() => {
                      setSelectedFood(fav);
                      setUsingServing("per100");
                      const g = extractGramAmount(fav.servingSize);
                      setGrams(g ?? 100);
                    }}
                  >
                    ⭐ {fav.name}
                  </button>
                ))}
              </div>
            );

          return (
            <div key={meal} className="mb-3">
              <button
                className="bxkr-card w-100 mb-2 text-start d-flex justify-content-between align-items-center"
                style={{ borderRadius: 12, padding: "12px 14px" }}
                onClick={() => setOpenMeal(isOpen ? null : meal)}
              >
                <div className="fw-semibold">{meal} ({mealEntries.length})</div>
                <div className="small">
                  <span style={{ color: COLORS.calories }}>{round2(mealTotals.calories)} kcal</span>{" "}|{" "}
                  <span style={{ color: COLORS.protein }}>{round2(mealTotals.protein)}p</span>{" "}|{" "}
                  <span style={{ color: COLORS.carbs }}>{round2(mealTotals.carbs)}c</span>{" "}|{" "}
                  <span style={{ color: COLORS.fat }}>{round2(mealTotals.fat)}f</span>
                </div>
              </button>

              {isOpen && (
                <div className="px-1">
                  {/* Favourites strip */}
                  {favouriteStrip}

                  {/* Search */}
                  <div className="d-flex gap-2 mb-2">
                    <input
                      className="form-control bxkr-input"
                      placeholder={`Search foods for ${meal}…`}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>

                  {/* Scanner gate */}
                  <BarcodeScannerGate
                    isPremium={Boolean(isPremium)}
                    onScanRequested={() => {
                      setScannerKey((k) => k + 1); // force remount for reliability
                      setScannerOpen(true);
                    }}
                  />

                  {loadingSearch && <div className="text-dim">Searching…</div>}

                  {/* Editor fallback */}
                  {selectedFood && results.length === 0 && (
                    <FoodEditor
                      meal={meal}
                      food={selectedFood}
                      grams={grams}
                      setGrams={setGrams}
                      usingServing={usingServing}
                      setUsingServing={setUsingServing}
                      scaledSelected={scaledSelected}
                      addEntry={addEntry}
                      isFavourite={isFavourite(selectedFood)}
                      onToggleFavourite={() => toggleFavourite(selectedFood)}
                    />
                  )}

                  {/* Results */}
                  {results.length > 0 &&
                    results.slice(0, 5).map((f) => (
                      <div key={f.id ?? f.code ?? f.name} className="mb-1">
                        {selectedFood?.id === f.id ? (
                          <FoodEditor
                            meal={meal}
                            food={selectedFood}
                            grams={grams}
                            setGrams={setGrams}
                            usingServing={usingServing}
                            setUsingServing={setUsingServing}
                            scaledSelected={scaledSelected}
                            addEntry={addEntry}
                            isFavourite={isFavourite(selectedFood)}
                            onToggleFavourite={() => toggleFavourite(selectedFood!)}
                          />
                        ) : (
                          <div
                            className="bxkr-card d-flex justify-content-between align-items-center"
                            style={{ padding: "10px 12px", borderRadius: 12, cursor: "pointer" }}
                            onClick={() => {
                              setSelectedFood(f);
                              setUsingServing("per100");
                              const g = extractGramAmount(f.servingSize);
                              setGrams(g ?? 100);
                            }}
                          >
                            <span className="small">
                              <span className="fw-semibold">{f.name}</span>
                              {f.brand ? <span className="text-dim"> ({f.brand})</span> : null} —{" "}
                              {round2(f.calories)} kcal/100g
                            </span>
                            <button
                              type="button"
                              className="bxkr-pill"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                toggleFavourite(f);
                              }}
                              title={isFavourite(f) ? "Unfavourite" : "Favourite"}
                            >
                              <i className={isFavourite(f) ? "fas fa-star text-warning" : "far fa-star text-dim"} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                  <button
                    className="bxkr-pill mb-2"
                    onClick={() => {
                      setSelectedFood({
                        id: `manual-${Date.now()}`,
                        code: "",
                        name: "",
                        brand: "",
                        image: null,
                        calories: 0,
                        protein: 0,
                        carbs: 0,
                        fat: 0,
                      });
                      setUsingServing("per100");
                      setGrams(100);
                    }}
                  >
                    + Add manual food
                  </button>

                  {/* Meal entries */}
                  {mealEntries.map((e) => (
                    <div
                      key={e.id}
                      className="bxkr-card p-3 mb-2 d-flex justify-content-between align-items-center"
                      style={{ borderRadius: 12 }}
                    >
                      <div>
                        <div className="fw-bold d-flex align-items-center">
                          {e.food.name} {e.food.brand ? <span className="text-dim">({e.food.brand})</span> : null}
                          <button
                            type="button"
                            className="btn btn-link p-0 ms-2"
                            onClick={() => toggleFavourite(e.food)}
                            title={isFavourite(e.food) ? "Unfavourite" : "Favourite"}
                          >
                            <i className={isFavourite(e.food) ? "fas fa-star text-warning" : "far fa-star text-dim"} />
                          </button>
                        </div>
                        <div className="small text-dim">{e.grams} g</div>
                        <div className="small">
                          <span style={{ color: COLORS.calories }}>{round2(e.calories)} kcal</span> |{" "}
                          <span style={{ color: COLORS.protein }}>{round2(e.protein)}p</span> |{" "}
                          <span style={{ color: COLORS.carbs }}>{round2(e.carbs)}c</span> |{" "}
                          <span style={{ color: COLORS.fat }}>{round2(e.fat)}f</span>
                        </div>
                      </div>
                      <button className="bxkr-pill" onClick={() => removeEntry(e.id)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* Scanner Modal */}
      <BarcodeScannerClient
        key={scannerKey}
        isOpen={scannerOpen && Boolean(isPremium)}
        onClose={() => setScannerOpen(false)}
        onFoundFood={(food) => {
          setResults([food]);
          setSelectedFood(food);
        }}
        onLookupBarcode={async (code: string) => await handleBarcodeLookup(code)}
      />

      <BottomNav />
    </>
  );
}
