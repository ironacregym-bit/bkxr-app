
"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { useSession, signIn } from "next-auth/react";
import BottomNav from "../components/BottomNav";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const meals = ["Breakfast", "Lunch", "Dinner", "Snack"];

function round2(n: number | undefined) {
  return n !== undefined ? n.toFixed(2) : "-";
}

export default function NutritionPage() {
  const { data: session } = useSession();
  const [openMeal, setOpenMeal] = useState<string | null>(null);

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedFood, setSelectedFood] = useState<any | null>(null);
  const [grams, setGrams] = useState(100);
  const [adding, setAdding] = useState(false);

  // Today's date key
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Fetch logs
  const { data: logsData } = useSWR(
    session?.user?.email ? `/api/nutrition/logs?date=${todayKey}` : null,
    fetcher
  );

  // Fetch user goals
  const { data: profile } = useSWR(session?.user?.email ? `/api/profile?email=${encodeURIComponent(session.user.email)}` : null, fetcher);
  const goals = {
    calories: profile?.caloric_target || 2000,
    protein: profile?.protein_target || 150,
    carbs: profile?.carb_target || 250,
    fat: profile?.fat_target || 70,
  };

  // Totals
  const totals = useMemo(() => {
    const entries = logsData?.entries || [];
    return entries.reduce(
      (acc: { calories: number; protein: number; carbs: number; fat: number }, e: any) => {
        acc.calories += e.calories || 0;
        acc.protein += e.protein || 0;
        acc.carbs += e.carbs || 0;
        acc.fat += e.fat || 0;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [logsData]);

  const progress = {
    calories: (totals.calories / goals.calories) * 100,
    protein: (totals.protein / goals.protein) * 100,
    carbs: (totals.carbs / goals.carbs) * 100,
    fat: (totals.fat / goals.fat) * 100,
  };

  // Debounce search
  function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
    let timer: NodeJS.Timeout;
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
          setResults(json.foods || []);
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

  const scaledSelected = useMemo(() => {
    if (!selectedFood) return null;
    const factor = grams / 100;
    return {
      ...selectedFood,
      calories: +(selectedFood.calories * factor).toFixed(2),
      protein: +(selectedFood.protein * factor).toFixed(2),
      carbs: +(selectedFood.carbs * factor).toFixed(2),
      fat: +(selectedFood.fat * factor).toFixed(2),
    };
  }, [selectedFood, grams]);

  const addEntry = async (meal: string, food: any) => {
    if (!session?.user?.email || !food) return signIn("google");
    setAdding(true);

    try {
      const payload = {
        date: todayKey,
        meal,
        food,
        grams,
        calories: scaledSelected.calories,
        protein: scaledSelected.protein,
        carbs: scaledSelected.carbs,
        fat: scaledSelected.fat,
      };

      const optimistic = { id: `temp-${Date.now()}`, created_at: new Date().toISOString(), ...payload };
      mutate(
        `/api/nutrition/logs?date=${todayKey}`,
        (data: any) => ({ entries: [optimistic, ...(data?.entries || [])] }),
        false
      );

      const res = await fetch("/api/nutrition/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");

      mutate(`/api/nutrition/logs?date=${todayKey}`);
      setSelectedFood(null);
      setQuery("");
      setResults([]);
      setGrams(100);
    } finally {
      setAdding(false);
    }
  };

  const removeEntry = async (id: string) => {
    if (!confirm("Remove this entry?")) return;
    await fetch(`/api/nutrition/logs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    mutate(`/api/nutrition/logs?date=${todayKey}`);
  };

  return (
    <>
      <main className="container py-3" style={{ paddingBottom: "90px" }}>
        <h2 className="mb-3 text-center">Nutrition</h2>

        {/* Top Section */}
        <div className="row mb-4">
          {/* Left Column */}
          <div className="col-6">
            <h5>Macros</h5>
            <p className="text-primary">Calories: {round2(totals.calories)} / {goals.calories}</p>
            <p className="text-success">Protein: {round2(totals.protein)} / {goals.protein} g</p>
            <p className="text-warning">Carbs: {round2(totals.carbs)} / {goals.carbs} g</p>
            <p style={{ color: "#d63384" }}>Fat: {round2(totals.fat)} / {goals.fat} g</p>
          </div>

          {/* Right Column - Nested Circular Charts */}
          <div className="col-6 d-flex justify-content-center">
            <div style={{ position: "relative", width: 160, height: 160 }}>
              <div style={{ position: "absolute", top: 0, left: 0, width: 160, height: 160 }}>
                <CircularProgressbar
                  value={progress.calories}
                  styles={buildStyles({ pathColor: "blue", trailColor: "#eee", pathTransitionDuration: 1 })}
                />
              </div>
              <div style={{ position: "absolute", top: 10, left: 10, width: 140, height: 140 }}>
                <CircularProgressbar
                  value={progress.protein}
                  styles={buildStyles({ pathColor: "green", trailColor: "#eee", pathTransitionDuration: 1 })}
                />
              </div>
              <div style={{ position: "absolute", top: 20, left: 20, width: 120, height: 120 }}>
                <CircularProgressbar
                  value={progress.carbs}
                  styles={buildStyles({ pathColor: "orange", trailColor: "#eee", pathTransitionDuration: 1 })}
                />
              </div>
              <div style={{ position: "absolute", top: 30, left: 30, width: 100, height: 100 }}>
                <CircularProgressbar
                  value={progress.fat}
                  styles={buildStyles({ pathColor: "#d63384", trailColor: "#eee", pathTransitionDuration: 1 })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Meals */}
        {meals.map((meal) => {
          const mealEntries = logsData?.entries?.filter((e: any) => e.meal === meal) || [];
          const isOpen = openMeal === meal;
          const mealTotals = mealEntries.reduce(
            (acc: { calories: number; protein: number; carbs: number; fat: number }, e: any) => {
              acc.calories += e.calories || 0;
              acc.protein += e.protein || 0;
              acc.carbs += e.carbs || 0;
              acc.fat += e.fat || 0;
              return acc;
            },
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
          );

          return (
            <div key={meal} className="mb-3">
              <button
                className="btn btn-outline-primary w-100 mb-2 text-start"
                onClick={() => setOpenMeal(isOpen ? null : meal)}
              >
                {meal} ({mealEntries.length}) - 
                <span className="text-primary"> {round2(mealTotals.calories)} kcal</span> | 
                <span className="text-success"> {round2(mealTotals.protein)}p</span> | 
                <span className="text-warning"> {round2(mealTotals.carbs)}c</span> | 
                <span style={{ color: "#d63384" }}> {round2(mealTotals.fat)}f</span>
              </button>

              {isOpen && (
                <div className="px-2">
                  {/* Add food search */}
                  <input
                    className="form-control mb-2"
                    placeholder={`Search foods for ${meal}...`}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />

                  {loadingSearch && <div>Searching…</div>}

                  {results.length > 0 && results.slice(0, 5).map((f) => (
                    <div key={f.id ?? f.code ?? f.name} className="mb-1">
                      {selectedFood?.id === f.id ? (
                        <div className="bxkr-card p-2 mb-1">
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <input
                              type="number"
                              className="form-control w-25"
                              value={grams}
                              onChange={(e) => setGrams(Number(e.target.value))}
                            />
                            <div>
                              <span className="text-primary">{round2(scaledSelected?.calories)} kcal</span> | 
                              <span className="text-success">{round2(scaledSelected?.protein)}p</span> | 
                              <span className="text-warning">{round2(scaledSelected?.carbs)}c</span> | 
                              <span style={{ color: "#d63384" }}>{round2(scaledSelected?.fat)}f</span>
                            </div>
                          </div>
                          <button
                            className="btn btn-primary w-100 mb-1"
                            onClick={() => addEntry(meal, selectedFood)}
                            disabled={adding}
                          >
                            Add to {meal}
                          </button>
                          <div className="fw-bold">{f.name} ({f.brand}) - {round2(f.calories)} kcal/100g</div>
                        </div>
                      ) : (
                        <button
                          className="list-group-item list-group-item-action"
                          onClick={() => setSelectedFood(f)}
                        >
                          {f.name} ({f.brand}) - {round2(f.calories)} kcal/100g
                        </button>
                      )}
                    </div>
                  ))}

                  {/* Manual entry */}
                  <button
                    className="btn btn-outline-secondary w-100 mb-2"
                    onClick={() =>
                      setSelectedFood({ id: `manual-${Date.now()}`, name: "", calories: 0, protein: 0, carbs: 0, fat: 0, brand: "" })
                    }
                  >
                    Add manual food
                  </button>

                  {/* Meal entries */}
                  {mealEntries.map((e: any) => (
                    <div key={e.id} className="bxkr-card p-2 mb-1 d-flex justify-content-between align-items-center">
                      <div>
                        <div className="fw-bold">{e.food.name} ({e.food.brand})</div>
                        <div className="small text-muted">{e.grams} g</div>
                        <div className="small">
                          <span className="text-primary">{round2(e.calories)} kcal</span> | 
                          <span className="text-success">{round2(e.protein)}p</span> | 
                          <span className="text-warning">{round2(e.carbs)}c</span> | 
                          <span style={{ color: "#d63384" }}>{round2(e.fat)}f</span>
                        </div>
                      </div>
                      <button className="btn btn-link text-danger" onClick={() => removeEntry(e.id)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </main>

      <BottomNav />
    </>
  );
}
