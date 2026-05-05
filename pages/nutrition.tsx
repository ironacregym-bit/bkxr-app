// pages/nutrition.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import useSWR, { mutate } from "swr";
import { useSession, signIn } from "next-auth/react";

import BottomNav from "../components/BottomNav";
import GlobalNumericFocus from "../components/GlobalNumericFocus";
import MacrosCard, {
  MacroGoals,
  MacroProgress,
  MacroTotals,
} from "../components/nutrition/MacrosCard";
import NutritionMealsCard from "../components/nutrition/NutritionMealsCard";
import AddFoodSheet from "../components/nutrition/AddFoodSheet";
import BarcodeScannerClient from "../components/nutrition/BarcodeScannerClient";
import FoodEditor, { Food } from "../components/nutrition/FoodEditor";

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

export default function NutritionPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const formattedDate = useMemo(() => ymd(selectedDate), [selectedDate]);

  // Add food sheet state
  const [sheetMeal, setSheetMeal] = useState<string | null>(null);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [usingServing, setUsingServing] =
    useState<"per100" | "serving">("per100");

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Scanner
  const [scannerOpen, setScannerOpen] = useState(false);

  // Logs
  const swrKey = session?.user?.email
    ? `/api/nutrition/logs?date=${formattedDate}`
    : null;
  const { data: logsData } = useSWR(swrKey, fetcher);

  // Profile
  const { data: profile } = useSWR(
    session?.user?.email
      ? `/api/profile?email=${encodeURIComponent(session.user.email)}`
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
    return (logsData?.entries || []).reduce(
      (acc: MacroTotals, e: any) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.protein,
        carbs: acc.carbs + e.carbs,
        fat: acc.fat + e.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [logsData]);

  const progress: MacroProgress = {
    calories: Math.min(100, (totals.calories / goals.calories) * 100),
    protein: Math.min(100, (totals.protein / goals.protein) * 100),
    carbs: Math.min(100, (totals.carbs / goals.carbs) * 100),
    fat: Math.min(100, (totals.fat / goals.fat) * 100),
  };

  // Search debounce
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    let active = true;
    setLoadingSearch(true);

    fetch(`/api/foods/search?query=${encodeURIComponent(query)}`)
      .then((r) => r.json())
      .then((j) => {
        if (active) setResults(j.foods || []);
      })
      .finally(() => active && setLoadingSearch(false));

    return () => {
      active = false;
    };
  }, [query]);

  // Add entry
  async function addEntry(meal: string, food: Food) {
    if (!session?.user?.email) return signIn("google");

    const payload = {
      date: formattedDate,
      meal,
      food,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
    };

    await fetch("/api/nutrition/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    mutate(swrKey);
    setSelectedFood(null);
    setQuery("");
    setResults([]);
    setSheetMeal(null);
  }

  return (
    <>
      <GlobalNumericFocus />

      <main className="container py-3 text-white" style={{ paddingBottom: 90 }}>
        {/* Date nav */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <button
            className="btn btn-bxkr-outline"
            onClick={() => setSelectedDate((d) => dayMinus(d, 1))}
          >
            ← Previous
          </button>

          <div className="fw-bold">Nutrition ({formattedDate})</div>

          <button
            className="btn btn-bxkr-outline"
            onClick={() => setSelectedDate(new Date())}
          >
            Today
          </button>
        </div>

        {/* Progress */}
        <MacrosCard totals={totals} goals={goals} progress={progress} />

        {/* Meals */}
        <NutritionMealsCard
          meals={meals}
          entries={logsData?.entries || []}
          onAddFood={(meal) => setSheetMeal(meal)}
          onEditEntry={(e) => {
            setSheetMeal(e.meal);
            setSelectedFood(e.food);
          }}
          onRemoveEntry={async (id) => {
            await fetch(
              `/api/nutrition/logs?id=${encodeURIComponent(
                id
              )}&date=${formattedDate}`,
              { method: "DELETE" }
            );
            mutate(swrKey);
          }}
        />
      </main>

      {/* Add Food Sheet */}
      <AddFoodSheet
        open={Boolean(sheetMeal)}
        meal={sheetMeal}
        query={query}
        setQuery={setQuery}
        results={results}
        loading={loadingSearch}
        favourites={[]}
        onSelectFood={setSelectedFood}
        onCreateManual={() =>
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
          })
        }
        onClose={() => {
          setSheetMeal(null);
          setSelectedFood(null);
        }}
        isPremium={Boolean(isPremium)}
        onScanRequested={() => setScannerOpen(true)}
        selectedFood={selectedFood}
        usingServing={usingServing}
        setUsingServing={setUsingServing}
        addEntry={addEntry}
        toggleFavourite={() => {}}
        isFavourite={() => false}
        onChangeFood={(patch) =>
          setSelectedFood((f) => (f ? { ...f, ...patch } : f))
        }
      />

      {/* Scanner */}
      <BarcodeScannerClient
        isOpen={scannerOpen && Boolean(isPremium)}
        onClose={() => setScannerOpen(false)}
        onFoundFood={(food) => {
          setScannerOpen(false);
          setSelectedFood(food);
        }}
        onLookupBarcode={async (code) => {
          const r = await fetch(
            `/api/foods/lookup-barcode?barcode=${encodeURIComponent(code)}`
          );
          const j = await r.json();
          return j.foods?.[0];
        }}
      />

      <BottomNav />
    </>
  );
}
