// File: pages/nutrition.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
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
        : `bxkr:favs:anon`,
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
    return favourites.some(
      (f) => f.id === food.id || (food.code && f.code === food.code)
    );
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
  const [usingServing, setUsingServing] =
    useState<"per100" | "serving">("per100");

  const [query, setQuery] = useState<string>("");
  const [results, setResults] = useState<Food[]>([]);
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);

  useEffect(() => {
    const q = query.trim();
    if (!q || q.length < 2) {
      setResults([]);
      setLoadingSearch(false);
      return;
    }

    const t = setTimeout(async () => {
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
    }, 250);

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
      // If it fails, revalidate to correct optimistic UI
    } finally {
      if (swrKey) mutate(swrKey);
    }

    setSelectedFood(null);
    setQuery("");
    setResults([]);
    setUsingServing("per100");
    setSheetMeal(null);
  };

  const removeEntry = async (id: string) => {
    if (!confirm("Remove this entry?")) return;
    await fetch(
      `/api/nutrition/logs?id=${encodeURIComponent(id)}&date=${formattedDate}`,
      { method: "DELETE" }
    );
    if (swrKey) mutate(swrKey);
  };

  return (
    <>
      <GlobalNumericFocus />

      <main
        className="container py-3"
        style={{ paddingBottom: "90px", color: "#fff" }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <button className="btn btn-bxkr-outline" onClick={goPrevDay}>
            ← Previous
          </button>

          <div className="text-center">
            <div className="fw-bold" style={{ lineHeight: 1.1 }}>
              Nutrition
            </div>
            <div className="text-dim small">{formattedDate}</div>
          </div>

          <button
            className="btn btn-bxkr-outline"
            onClick={goNextDay}
            disabled={!canGoNext}
            title={!canGoNext ? "You can’t go into the future" : "Next day"}
          >
            Next →
          </button>
        </div>

        <MacrosCard totals={totals} goals={goals} progress={progress} />

        <NutritionMealsCard
          meals={meals}
          entries={logsData?.entries || []}
          onAddFood={(meal) => {
            setSheetMeal(meal);
            setSelectedFood(null);
            setQuery("");
            setResults([]);
          }}
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
        onSelectFood={(food) => setSelectedFood(food)}
        onCreateManual={() => setSelectedFood(createManualFood())}
        onClose={() => {
          setSheetMeal(null);
          setSelectedFood(null);
          setQuery("");
          setResults([]);
          setUsingServing("per100");
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
          const res = await fetch(
            `/api/foods/lookup-barcode?barcode=${encodeURIComponent(code)}`
          );
          const json = await res.json();
          const found: Food | undefined = (json.foods || [])[0] as
            | Food
            | undefined;
          return found;
        }}
      />

      <BottomNav />
    </>
  );
}
