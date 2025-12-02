"use client";

import Head from "next/head";
import { useState, useEffect, useMemo, useRef } from "react";
import useSWR, { mutate } from "swr";
import { useSession, signIn } from "next-auth/react";
import BottomNav from "../components/BottomNav";

const meals = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;
const fetcher = (u: string) => fetch(u).then((r) => r.json());

function gramsToFactor(g: number) {
  return g / 100;
}

// Simple debounce hook
function useDebounce(fn: (...args: any[]) => void, delay: number) {
  const timeout = useRef<NodeJS.Timeout>();
  return (...args: any[]) => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => fn(...args), delay);
  };
}

export default function NutritionPage() {
  const { data: session } = useSession();
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Today's logs
  const { data: logsData, error: logsError } = useSWR(
    session?.user?.email ? `/api/nutrition/logs?date=${todayKey}` : null,
    fetcher
  );

  const [activeMeal, setActiveMeal] = useState<typeof meals[number] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedFood, setSelectedFood] = useState<any | null>(null);
  const [grams, setGrams] = useState(100);
  const [portionLabel, setPortionLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

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

  // Scaled nutrition
  const scaledSelected = useMemo(() => {
    if (!selectedFood) return null;
    const factor = gramsToFactor(grams);
    return {
      ...selectedFood,
      calories: Math.round((selectedFood.calories || 0) * factor),
      protein: +((selectedFood.protein || 0) * factor).toFixed(1),
      carbs: +((selectedFood.carbs || 0) * factor).toFixed(1),
      fat: +((selectedFood.fat || 0) * factor).toFixed(1),
    };
  }, [selectedFood, grams]);

  // Debounced search
  const doSearch = useDebounce(async (q: string) => {
    if (!q || q.trim().length < 2) return setResults([]);
    try {
      const res = await fetch(`/api/foods/search?query=${encodeURIComponent(q)}`);
      const json = await res.json();
      setResults(json.foods || []);
    } catch {
      setResults([]);
    }
  }, 300);

  useEffect(() => {
    doSearch(query);
  }, [query, doSearch]);

  // Scroll into view when card opens
  useEffect(() => {
    if (cardRef.current) cardRef.current.scrollIntoView({ behavior: "smooth" });
  }, [activeMeal]);

  const addEntry = async () => {
    if (!session?.user?.email) return signIn("google");
    if (!selectedFood && !portionLabel) return alert("Please select a food or enter manually.");

    setAdding(true);
    const payload = {
      date: todayKey,
      meal: activeMeal,
      food: selectedFood || { name: portionLabel },
      grams,
      portionLabel: portionLabel || "",
      calories: scaledSelected?.calories ?? 0,
      protein: scaledSelected?.protein ?? 0,
      carbs: scaledSelected?.carbs ?? 0,
      fat: scaledSelected?.fat ?? 0,
    };

    // Optimistic update
    const tempEntry = { id: `temp-${Date.now()}`, created_at: new Date().toISOString(), ...payload };
    mutate(`/api/nutrition/logs?date=${todayKey}`, (data: any) => ({
      entries: [tempEntry, ...(data?.entries || [])],
    }), false);

    try {
      const res = await fetch("/api/nutrition/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch (err) {
      console.error(err);
    } finally {
      mutate(`/api/nutrition/logs?date=${todayKey}`);
      setSelectedFood(null);
      setQuery("");
      setGrams(100);
      setPortionLabel("");
      setActiveMeal(null);
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
      <Head>
        <title>Nutrition — BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-3" style={{ paddingBottom: "90px" }}>
        <h2 className="mb-3 text-center">Nutrition</h2>

        {/* Totals */}
        <div className="d-flex justify-content-around mb-3">
          <div>Calories: {totals.calories}</div>
          <div>Protein: {totals.protein}g</div>
          <div>Carbs: {totals.carbs}g</div>
          <div>Fat: {totals.fat}g</div>
        </div>

        {/* Meals */}
        {meals.map((m) => {
          const entries = (logsData?.entries || []).filter((e: any) => e.meal === m);
          const mealTotals = entries.reduce(
            (acc: any, e: any) => {
              acc.calories += e.calories;
              acc.protein += e.protein;
              acc.carbs += e.carbs;
              acc.fat += e.fat;
              return acc;
            },
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
          );

          return (
            <div key={m} className="mb-4">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5>{m} ({mealTotals.calories} kcal)</h5>
                <button className="btn btn-sm btn-outline-primary" onClick={() => setActiveMeal(activeMeal === m ? null : m)}>
                  Add Food
                </button>
              </div>

              {/* Entries */}
              {entries.length === 0 && <div className="text-muted mb-2">No items</div>}
              {entries.map((e: any) => (
                <div key={e.id} className="d-flex justify-content-between mb-1 bxkr-card p-2 align-items-center">
                  <div>{e.portionLabel || e.grams + "g"} {e.food.name}</div>
                  <div className="text-end">
                    {e.calories} kcal • {e.protein}p • {e.carbs}c • {e.fat}f
                    <button className="btn btn-link btn-sm text-danger ms-2" onClick={() => removeEntry(e.id)}>Remove</button>
                  </div>
                </div>
              ))}

              {/* Add Food Card */}
              {activeMeal === m && (
                <div ref={cardRef} className="bxkr-card p-2 mt-2">
                  <input
                    className="form-control mb-1"
                    placeholder="Search foods or enter manually"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />

                  {results.length > 0 && (
                    <div className="list-group mb-1">
                      {results.slice(0, 10).map((f: any) => (
                        <button key={f.id} className="list-group-item list-group-item-action" onClick={() => setSelectedFood(f)}>
                          {f.name} - {f.brand} ({f.calories} kcal /100g)
                        </button>
                      ))}
                    </div>
                  )}

                  {(selectedFood || query) && (
                    <>
                      <input
                        type="number"
                        className="form-control mb-1"
                        value={grams}
                        onChange={(e) => setGrams(Number(e.target.value))}
                        placeholder="grams"
                      />
                      <input
                        type="text"
                        className="form-control mb-1"
                        value={portionLabel}
                        onChange={(e) => setPortionLabel(e.target.value)}
                        placeholder="e.g. 1 medium banana"
                      />

                      <div className="d-flex justify-content-between mb-1">
                        <div>Calories: {scaledSelected?.calories ?? 0}</div>
                        <div>Protein: {scaledSelected?.protein ?? 0}g</div>
                        <div>Carbs: {scaledSelected?.carbs ?? 0}g</div>
                        <div>Fat: {scaledSelected?.fat ?? 0}g</div>
                      </div>

                      <button className="btn btn-primary w-100" onClick={addEntry} disabled={adding}>
                        {adding ? "Adding…" : "Add to {m}"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {logsError && <div className="alert alert-danger">Failed to load logs</div>}
      </main>

      <BottomNav />
    </>
  );
}