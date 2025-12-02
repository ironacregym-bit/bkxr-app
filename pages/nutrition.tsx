"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { useSession, signIn } from "next-auth/react";
import BottomNav from "../components/BottomNav";

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
  const { data: logsData, error: logsError } = useSWR(
    session?.user?.email ? `/api/nutrition/logs?date=${todayKey}` : null,
    fetcher
  );

  // Totals
  const totals = useMemo(() => {
    const entries = logsData?.entries || [];
    return entries.reduce(
      (acc: any, e: any) => {
        acc.calories += e.calories || 0;
        acc.protein += e.protein || 0;
        acc.carbs += e.carbs || 0;
        acc.fat += e.fat || 0;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [logsData]);

  // Debounce function
  function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
    let timer: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // Search OpenFoodFacts
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

  // Compute scaled nutrition
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

  // Add entry
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

        {/* Macro tiles */}
        <div className="row text-center mb-3 gx-2">
          <div className="col">
            <div className="bxkr-card py-2">
              <div><i className="fas fa-fire text-warning me-1"></i>Calories</div>
              <div className="fw-bold">{round2(totals.calories)}</div>
            </div>
          </div>
          <div className="col">
            <div className="bxkr-card py-2">
              <div><i className="fas fa-drumstick-bite text-danger me-1"></i>Protein</div>
              <div className="fw-bold">{round2(totals.protein)} g</div>
            </div>
          </div>
          <div className="col">
            <div className="bxkr-card py-2">
              <div><i className="fas fa-bread-slice text-success me-1"></i>Carbs</div>
              <div className="fw-bold">{round2(totals.carbs)} g</div>
            </div>
          </div>
          <div className="col">
            <div className="bxkr-card py-2">
              <div><i className="fas fa-oil-can text-secondary me-1"></i>Fat</div>
              <div className="fw-bold">{round2(totals.fat)} g</div>
            </div>
          </div>
        </div>

        {/* Meals */}
        {meals.map((meal) => {
          const mealEntries = logsData?.entries?.filter((e: any) => e.meal === meal) || [];
          const isOpen = openMeal === meal;

          return (
            <div key={meal} className="mb-3">
              <button
                className="btn btn-outline-primary w-100 mb-2 text-start"
                onClick={() => setOpenMeal(isOpen ? null : meal)}
              >
                {meal} ({mealEntries.length})
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
                          {/* Amount & macros ABOVE */}
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <input
                              type="number"
                              className="form-control w-25"
                              value={grams}
                              onChange={(e) => setGrams(Number(e.target.value))}
                            />
                            <div>
                              {round2(scaledSelected?.calories)} kcal | {round2(scaledSelected?.protein)}p | {round2(scaledSelected?.carbs)}c | {round2(scaledSelected?.fat)}f
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
                        <div className="small">{round2(e.calories)} kcal | {round2(e.protein)}p | {round2(e.carbs)}c | {round2(e.fat)}f</div>
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