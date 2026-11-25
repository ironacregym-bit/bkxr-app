// pages/nutrition.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import useSWR, { mutate } from "swr";
import { useSession, signIn } from "next-auth/react";

import BottomNav from "../components/BottomNav";
import GlobalNumericFocus from "../components/GlobalNumericFocus";

import MacrosCard, {
  type MacroGoals,
  type MacroProgress,
  type MacroTotals,
} from "../components/nutrition/MacrosCard";
import NutritionMealsCard from "../components/nutrition/NutritionMealsCard";
import AddFoodSheet from "../components/nutrition/AddFoodSheet";
import BarcodeScannerClient from "../components/nutrition/BarcodeScannerClient";
import type { Food } from "../components/nutrition/FoodEditor";
import { NUTRITION_COLORS as COLORS } from "../components/nutrition/nutritionTheme";
import AIImportButton from "../components/nutrition/AIImportButton";
import AIImportModal from "../components/nutrition/AIImportModal";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const meals = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function dayMinus(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(d.getDate() - days);
  return x;
}

function dayPlus(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(d.getDate() + days);
  return x;
}

function normaliseQuery(q: string) {
  return String(q || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function fmt0(n: number | undefined | null) {
  return Number.isFinite(Number(n)) ? String(Math.round(Number(n))) : "0";
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

type LogsResponse = {
  entries: NutritionEntry[];
};

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

export type SavedMealItem = {
  food: Food;
  grams?: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type SavedMeal = {
  id: string;
  name: string;
  source_meal?: string;
  item_count?: number;
  totals?: MacroTotals;
  items: SavedMealItem[];
  created_at?: string;
  updated_at?: string;
  last_used_at?: string | null;
};

type SavedMealsResponse = {
  meals?: SavedMeal[];
};

type SaveMealModalState = {
  open: boolean;
  meal: string | null;
  name: string;
};

export default function NutritionPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    const q = router.query.date;
    if (!q) return;

    const parsed = new Date(String(q));
    if (!isNaN(parsed.getTime())) setSelectedDate(parsed);
  }, [router.query.date]);

  const formattedDate = useMemo(() => ymd(selectedDate), [selectedDate]);
  const todayKey = useMemo(() => ymd(new Date()), []);
  const canGoNext = formattedDate < todayKey;

  const goPrevDay = () => setSelectedDate((d) => dayMinus(d, 1));

  const goNextDay = () => {
    if (!canGoNext) return;
    setSelectedDate((d) => dayPlus(d, 1));
  };

  const swrKey = session?.user?.email
    ? `/api/nutrition/logs?date=${formattedDate}`
    : null;

  const { data: logsData } = useSWR<LogsResponse>(swrKey, fetcher);

  const savedMealsKey = session?.user?.email
    ? "/api/nutrition/saved-meals?limit=10"
    : null;

  const {
    data: savedMealsData,
    mutate: mutateSavedMeals,
    isLoading: savedMealsLoading,
  } = useSWR<SavedMealsResponse>(savedMealsKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const savedMeals = useMemo(() => {
    return Array.isArray(savedMealsData?.meals) ? savedMealsData.meals : [];
  }, [savedMealsData]);

  const { data: profile } = useSWR<UserProfile>(
    session?.user?.email
      ? `/api/profile?email=${encodeURIComponent(session.user.email as string)}`
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

  const [favourites, setFavourites] = useState<Food[]>([]);

  const favKey = useMemo(
    () =>
      session?.user?.email
        ? `bxkr:favs:${session.user.email as string}`
        : "bxkr:favs:anon",
    [session?.user?.email]
  );

  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;

    try {
      const existing = localStorage.getItem(favKey);
      const parsed: Food[] = existing ? JSON.parse(existing) : [];

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
      : [{ ...food }, ...favourites].slice(0, 30);

    saveFavourites(next);
  };

  const [sheetMeal, setSheetMeal] = useState<string | null>(null);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [usingServing, setUsingServing] = useState<"per100" | "serving">("per100");

  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<Food[]>([]);
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);

  const [savingMealName, setSavingMealName] = useState<string | null>(null);
  const [addingSavedMealId, setAddingSavedMealId] = useState<string | null>(null);

  const [saveMealModal, setSaveMealModal] = useState<SaveMealModalState>({
    open: false,
    meal: null,
    name: "",
  });
  const [saveMealError, setSaveMealError] = useState<string | null>(null);

  const searchAbortRef = useRef<AbortController | null>(null);
  const searchReqIdRef = useRef(0);
  const searchCacheRef = useRef<Map<string, Food[]>>(new Map());
  const lastCompletedQueryRef = useRef<string>("");

  function cancelSearch() {
    try {
      searchAbortRef.current?.abort();
    } catch {}

    searchAbortRef.current = null;
  }

  useEffect(() => {
    if (!sheetMeal) {
      cancelSearch();
      setLoadingSearch(false);
      return;
    }
  }, [sheetMeal]);

  useEffect(() => {
    if (selectedFood) {
      cancelSearch();
      setLoadingSearch(false);
    }
  }, [selectedFood]);

  useEffect(() => {
    const qNorm = normaliseQuery(query);

    if (!qNorm || qNorm.length < 3) {
      cancelSearch();
      setResults([]);
      setLoadingSearch(false);
      lastCompletedQueryRef.current = "";
      return;
    }

    const reqId = ++searchReqIdRef.current;

    const t = setTimeout(async () => {
      const cached = searchCacheRef.current.get(qNorm);

      if (cached) {
        setResults(cached);
      } else {
        setResults([]);
      }

      cancelSearch();

      const ctrl = new AbortController();
      searchAbortRef.current = ctrl;

      setLoadingSearch(true);

      try {
        const res = await fetch(`/api/foods/search?query=${encodeURIComponent(qNorm)}`, {
          signal: ctrl.signal,
          headers: { Accept: "application/json" },
        });

        const json = await res.json().catch(() => ({} as any));
        const foods = (json.foods || []) as Food[];

        if (reqId !== searchReqIdRef.current) return;
        if (ctrl.signal.aborted) return;

        const timedOut = Boolean(json?.meta?.timedOut);

        if (!timedOut) {
          searchCacheRef.current.set(qNorm, foods);
        }

        lastCompletedQueryRef.current = qNorm;
        setResults(foods);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        if (reqId !== searchReqIdRef.current) return;

        lastCompletedQueryRef.current = qNorm;
        setResults([]);
      } finally {
        if (reqId === searchReqIdRef.current) {
          setLoadingSearch(false);
        }
      }
    }, 500);

    return () => clearTimeout(t);
  }, [query]);

  function createManualFood(): Food {
    return {
      id: `manual-${Date.now()}`,
      code: "",
      name: "",
      brand: "",
      image: null,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      servingSize: null,
      caloriesPerServing: null,
      proteinPerServing: null,
      carbsPerServing: null,
      fatPerServing: null,
    };
  }

  const onChangeSelectedFood = (patch: Partial<Food>) => {
    setSelectedFood((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const [scannerOpen, setScannerOpen] = useState<boolean>(false);
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const [aiImportResult, setAiImportResult] = useState<any>(null);
  async function importAIResult(result: any) {
    if (!result) return;
  
    const food: Food = {
      id: `ai-${Date.now()}`,
      code: "",
      name: "AI Nutrition Import",
      brand: "Screenshot",
      image: null,
  
      calories: Number(result.calories || 0),
      protein: Number(result.protein || 0),
      carbs: Number(result.carbs || 0),
      fat: Number(result.fat || 0),
  
      servingSize: null,
      caloriesPerServing: null,
      proteinPerServing: null,
      carbsPerServing: null,
      fatPerServing: null,
    };
  
    await addEntry(
      "Snack",
      food
    );
  
    setAiImportOpen(false);
    setAiImportResult(null);
  }


  
  const addEntry = async (meal: string, food: Food) => {
    if (!session?.user?.email) return signIn("google");

    const payload: any = {
      date: formattedDate,
      meal,
      food,
      calories: Number(food.calories || 0),
      protein: Number(food.protein || 0),
      carbs: Number(food.carbs || 0),
      fat: Number(food.fat || 0),
    };

    if (swrKey) {
      const optimistic = {
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        ...payload,
      };

      mutate(
        swrKey,
        (data: LogsResponse | undefined) => ({
          entries: [optimistic as NutritionEntry, ...(data?.entries || [])],
        }),
        false
      );
    }

    try {
      const res = await fetch("/api/nutrition/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save");
    } catch {
      // Revalidate below.
    } finally {
      if (swrKey) mutate(swrKey);
    }

    setSelectedFood(null);
    setQuery("");
    setResults([]);
    setUsingServing("per100");
    setSheetMeal(null);
  };

  async function addSavedMealToLog(targetMeal: string, savedMeal: SavedMeal) {
    if (!session?.user?.email) return signIn("google");
    if (!savedMeal?.items?.length) return;

    setAddingSavedMealId(savedMeal.id);

    try {
      const createdAt = new Date().toISOString();

      if (swrKey) {
        const optimisticEntries = savedMeal.items.map((item, idx) => ({
          id: `saved-temp-${savedMeal.id}-${Date.now()}-${idx}`,
          created_at: createdAt,
          date: formattedDate,
          meal: targetMeal,
          food: item.food,
          grams: item.grams ?? null,
          calories: Number(item.calories || 0),
          protein: Number(item.protein || 0),
          carbs: Number(item.carbs || 0),
          fat: Number(item.fat || 0),
        })) as NutritionEntry[];

        mutate(
          swrKey,
          (data: LogsResponse | undefined) => ({
            entries: [...optimisticEntries, ...(data?.entries || [])],
          }),
          false
        );
      }

      for (const item of savedMeal.items) {
        const payload = {
          date: formattedDate,
          meal: targetMeal,
          food: item.food,
          grams: item.grams ?? null,
          calories: Number(item.calories || 0),
          protein: Number(item.protein || 0),
          carbs: Number(item.carbs || 0),
          fat: Number(item.fat || 0),
        };

        const res = await fetch("/api/nutrition/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error("Failed to add saved meal");
        }
      }

      await fetch(`/api/nutrition/saved-meals?id=${encodeURIComponent(savedMeal.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      }).catch(() => null);

      await Promise.allSettled([
        swrKey ? mutate(swrKey) : Promise.resolve(),
        mutateSavedMeals(),
      ]);

      setSelectedFood(null);
      setQuery("");
      setResults([]);
      setUsingServing("per100");
      setSheetMeal(null);
    } catch (err: any) {
      console.error("[nutrition/add-saved-meal]", err?.message || err);
      alert("Failed to add saved meal. Please try again.");

      if (swrKey) mutate(swrKey);
    } finally {
      setAddingSavedMealId(null);
    }
  }

  function openSaveMealModal(meal: string) {
    if (!session?.user?.email) {
      void signIn("google");
      return;
    }

    const mealEntries = (logsData?.entries || []).filter((entry) => entry.meal === meal);

    if (!mealEntries.length) {
      alert(`Add some foods to ${meal} before saving it as a meal.`);
      return;
    }

    setSaveMealError(null);
    setSaveMealModal({
      open: true,
      meal,
      name: `${meal} - ${formattedDate}`,
    });
  }

  function closeSaveMealModal() {
    if (savingMealName) return;

    setSaveMealModal({
      open: false,
      meal: null,
      name: "",
    });
    setSaveMealError(null);
  }

  const saveMealPreview = useMemo(() => {
    if (!saveMealModal.meal) {
      return {
        entries: [] as NutritionEntry[],
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } as MacroTotals,
      };
    }

    const entries = (logsData?.entries || []).filter(
      (entry) => entry.meal === saveMealModal.meal
    );

    const previewTotals = entries.reduce(
      (acc: MacroTotals, entry: NutritionEntry) => {
        acc.calories += Number(entry.calories || 0);
        acc.protein += Number(entry.protein || 0);
        acc.carbs += Number(entry.carbs || 0);
        acc.fat += Number(entry.fat || 0);
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return {
      entries,
      totals: previewTotals,
    };
  }, [logsData?.entries, saveMealModal.meal]);

  async function confirmSaveMeal() {
    if (!session?.user?.email) return signIn("google");

    const meal = saveMealModal.meal;
    const cleanName = String(saveMealModal.name || "").trim();

    if (!meal) return;

    if (!cleanName) {
      setSaveMealError("Give this saved meal a name.");
      return;
    }

    const mealEntries = (logsData?.entries || []).filter((entry) => entry.meal === meal);

    if (!mealEntries.length) {
      setSaveMealError(`Add some foods to ${meal} before saving it as a meal.`);
      return;
    }

    setSaveMealError(null);
    setSavingMealName(meal);

    try {
      const items: SavedMealItem[] = mealEntries.map((entry) => ({
        food: entry.food,
        grams: entry.grams ?? null,
        calories: Number(entry.calories || 0),
        protein: Number(entry.protein || 0),
        carbs: Number(entry.carbs || 0),
        fat: Number(entry.fat || 0),
      }));

      const res = await fetch("/api/nutrition/saved-meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          source_meal: meal,
          items,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Failed to save meal");
      }

      await mutateSavedMeals();

      setSaveMealModal({
        open: false,
        meal: null,
        name: "",
      });
      setSaveMealError(null);
    } catch (err: any) {
      console.error("[nutrition/save-meal]", err?.message || err);
      setSaveMealError(err?.message || "Failed to save meal.");
    } finally {
      setSavingMealName(null);
    }
  }
  async function copyYesterday() {
    if (
      !confirm(
        "Copy all meals from yesterday into this day?"
      )
    ) {
      return;
    }
  
    try {
      const res = await fetch(
        "/api/nutrition/copy-yesterday",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            date: formattedDate,
          }),
        }
      );
  
      const json = await res.json();
  
      if (!res.ok) {
        throw new Error(
          json?.error || "Copy failed"
        );
      }
  
      if (swrKey) {
        await mutate(swrKey);
      }
  
      alert(
        `Copied ${json.copied} nutrition entries`
      );
    } catch (err: any) {
      alert(
        err?.message ||
          "Failed to copy yesterday"
      );
    }
  }
  const removeEntry = async (id: string) => {
    if (!confirm("Remove this entry?")) return;

    await fetch(`/api/nutrition/logs?id=${encodeURIComponent(id)}&date=${formattedDate}`, {
      method: "DELETE",
    });

    if (swrKey) mutate(swrKey);
  };

  return (
    <>
      <GlobalNumericFocus />

      <main className="container py-3 ia-nutrition-page">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <button className="btn btn-bxkr-outline" onClick={goPrevDay}>
            ← Previous
          </button>

          <div className="text-center">
            <div className="ia-page-title">Nutrition</div>
            <div className="text-dim small">{formattedDate}</div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
            }}
          >
            <button
              className="btn btn-bxkr-outline"
              onClick={copyYesterday}
            >
              Copy Yesterday
            </button>
          
            <button
              className="btn btn-bxkr-outline"
              onClick={goNextDay}
              disabled={!canGoNext}
              title={
                !canGoNext
                  ? "You can’t go into the future"
                  : "Next day"
              }
            >
              Next →
            </button>
          </div>
        </div>

        <MacrosCard totals={totals} goals={goals} progress={progress} />
        <div
          className="d-flex justify-content-end mb-3"
          style={{ gap: 8 }}
        >
          <AIImportButton
            onImported={(result) => {
              setAiImportResult(result);
              setAiImportOpen(true);
            }}
          />
        </div>
        <NutritionMealsCard
          meals={meals}
          entries={logsData?.entries || []}
          onAddFood={(meal) => {
            setSheetMeal(meal);
            setSelectedFood(null);
            setQuery("");
            setResults([]);
          }}
          onSaveMeal={openSaveMealModal}
          savingMealName={savingMealName}
          onEditEntry={(entry) => {
            setSheetMeal(entry.meal);
            setSelectedFood(entry.food);
          }}
          onRemoveEntry={removeEntry}
        />
      </main>

      <AddFoodSheet
        open={Boolean(sheetMeal)}
        meal={sheetMeal}
        query={query}
        setQuery={setQuery}
        results={results}
        loading={loadingSearch}
        favourites={favourites}
        savedMeals={savedMeals}
        loadingSavedMeals={savedMealsLoading}
        addingSavedMealId={addingSavedMealId}
        onAddSavedMeal={(targetMeal, savedMeal) => {
          void addSavedMealToLog(targetMeal, savedMeal);
        }}
        onSelectFood={(food) => {
          cancelSearch();
          setSelectedFood(food);
        }}
        onCreateManual={() => {
          cancelSearch();
          setSelectedFood(createManualFood());
        }}
        onClose={() => {
          cancelSearch();
          setSheetMeal(null);
          setSelectedFood(null);
          setQuery("");
          setResults([]);
          setUsingServing("per100");
          setLoadingSearch(false);
        }}
        isPremium={Boolean(isPremium)}
        onScanRequested={() => setScannerOpen(true)}
        selectedFood={selectedFood}
        usingServing={usingServing}
        setUsingServing={setUsingServing}
        addEntry={addEntry}
        toggleFavourite={toggleFavourite}
        isFavourite={isFavourite}
        onChangeFood={onChangeSelectedFood}
      />

      <BarcodeScannerClient
        isOpen={scannerOpen && Boolean(isPremium)}
        onClose={() => setScannerOpen(false)}
        onFoundFood={(food) => {
          setScannerOpen(false);
          setSelectedFood(food);

          if (!sheetMeal) setSheetMeal("Breakfast");

          setQuery(food.name || food.code || "");
        }}
        onLookupBarcode={async (code: string) => {
          const res = await fetch(`/api/foods/lookup-barcode?barcode=${encodeURIComponent(code)}`);
          const json = await res.json();
          const found: Food | undefined = (json.foods || [])[0] as Food | undefined;
          return found;
        }}
      />

      {saveMealModal.open ? (
        <div className="ia-modal-backdrop" role="dialog" aria-modal="true" aria-label="Save meal">
          <div className="ia-modal-card" style={{ maxWidth: 520 }}>
            <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
              <div style={{ minWidth: 0 }}>
                <div className="ia-kicker mb-1">Saved meal</div>
                <div className="ia-tile-title">Save {saveMealModal.meal}</div>
                <div className="text-dim small mt-1">
                  Turn this {String(saveMealModal.meal || "meal").toLowerCase()} into a reusable meal.
                </div>
              </div>

              <button
                type="button"
                className="ia-btn ia-btn-outline"
                onClick={closeSaveMealModal}
                disabled={Boolean(savingMealName)}
                aria-label="Close save meal modal"
                style={{ minWidth: 40, minHeight: 40, padding: 0, borderRadius: 999 }}
              >
                ✕
              </button>
            </div>

            <div className="mb-3">
              <label className="form-label small text-dim mb-1">Meal name</label>
              <input
                className="form-control"
                value={saveMealModal.name}
                onChange={(event) => {
                  setSaveMealModal((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }));
                  setSaveMealError(null);
                }}
                placeholder="e.g. High protein breakfast"
                autoFocus
                style={{
                  minHeight: 44,
                  background: "#0b0f14",
                  color: "#fff",
                  borderColor: "rgba(255,255,255,0.1)",
                }}
              />
            </div>

            <div
              className="mb-3"
              style={{
                borderRadius: 14,
                padding: 12,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                <div className="ia-kicker">Meal preview</div>
                <div className="text-dim small">
                  {saveMealPreview.entries.length} item
                  {saveMealPreview.entries.length === 1 ? "" : "s"}
                </div>
              </div>

              <div className="small text-dim" style={{ lineHeight: 1.35 }}>
                <span style={{ color: COLORS.calories }}>
                  {fmt0(saveMealPreview.totals.calories)} kcal
                </span>{" "}
                <span className="text-dim">•</span>{" "}
                <span style={{ color: COLORS.protein }}>
                  P {fmt0(saveMealPreview.totals.protein)}
                </span>{" "}
                <span className="text-dim">•</span>{" "}
                <span style={{ color: COLORS.carbs }}>
                  C {fmt0(saveMealPreview.totals.carbs)}
                </span>{" "}
                <span className="text-dim">•</span>{" "}
                <span style={{ color: COLORS.fat }}>
                  F {fmt0(saveMealPreview.totals.fat)}
                </span>
              </div>

              {saveMealPreview.entries.length > 0 ? (
                <div className="mt-2" style={{ display: "grid", gap: 6 }}>
                  {saveMealPreview.entries.slice(0, 4).map((entry) => (
                    <div
                      key={entry.id}
                      className="small"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        color: "rgba(255,255,255,0.82)",
                      }}
                    >
                      <span
                        style={{
                          minWidth: 0,
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {entry.food?.name || "Food"}
                      </span>
                      <span style={{ color: COLORS.calories, flex: "0 0 auto" }}>
                        {fmt0(entry.calories)} kcal
                      </span>
                    </div>
                  ))}

                  {saveMealPreview.entries.length > 4 ? (
                    <div className="text-dim small">
                      +{saveMealPreview.entries.length - 4} more
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {saveMealError ? (
              <div className="ia-inline-note-error mb-3">{saveMealError}</div>
            ) : null}

            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="ia-btn ia-btn-outline"
                onClick={closeSaveMealModal}
                disabled={Boolean(savingMealName)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="ia-btn ia-btn-primary"
                onClick={() => {
                  void confirmSaveMeal();
                }}
                disabled={Boolean(savingMealName) || !saveMealModal.name.trim()}
              >
                {savingMealName ? "Saving…" : "Save meal"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <AIImportModal
        open={aiImportOpen}
        result={aiImportResult}
        onClose={() => {
          setAiImportOpen(false);
        }}
        onImport={importAIResult}
      />
      <BottomNav />
    </>
  );
}
