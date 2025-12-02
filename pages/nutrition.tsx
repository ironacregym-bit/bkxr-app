"use client";

import Head from "next/head";
import { useState, useEffect, useMemo } from "react";
import useSWR, { mutate } from "swr";
import debounce from "just-debounce-it";
import { useSession, signIn } from "next-auth/react";
import BottomNav from "../components/BottomNav";

const meals = ["Breakfast", "Lunch", "Dinner", "Snack"] as const;
const fetcher = (u: string) => fetch(u).then((r) => r.json());

function gramsToFactor(g: number) {
  return g / 100;
}

export default function NutritionPage() {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedFood, setSelectedFood] = useState<any | null>(null);
  const [grams, setGrams] = useState<number>(100);
  const [portionLabel, setPortionLabel] = useState("");
  const [meal, setMeal] = useState<typeof meals[number]>("Breakfast");
  const [adding, setAdding] = useState(false);
  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Fetch today's logs
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

  // Debounced search
  const doSearch = useMemo(
    () =>
      debounce(async (q: string) => {
        if (!q || q.trim().length < 2) {
          setResults([]);
          return;
        }
        try {
          const res = await fetch(`/api/foods/search?query=${encodeURIComponent(q)}`);
          const json = await res.json();
          setResults(json.foods || []);
        } catch {
          setResults([]);
        }
      }, 300),
    []
  );

  useEffect(() => {
    doSearch(query);
  }, [query, doSearch]);

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

  const addEntry = async () => {
    if (!session?.user?.email || !selectedFood) return signIn("google");
    setAdding(true);

    const payload = {
      date: todayKey,
      food: selectedFood,
      grams,
      portionLabel,
      meal,
      calories: scaledSelected?.calories,
      protein: scaledSelected?.protein,
      carbs: scaledSelected?.carbs,
      fat: scaledSelected?.fat,
    };

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

        {/* Search and add food */}
        <div className="mb-3">
          <input
            className="form-control mb-2"
            placeholder="Search foods (OpenFoodFacts)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {results.length > 0 && (
            <div className="list-group mb-2">
              {results.slice(0, 10).map((f: any) => (
                <button
                  key={f.id}
                  className="list-group-item list-group-item-action"
                  onClick={() => setSelectedFood(f)}
                >
                  {f.name} - {f.brand} ({f.calories} kcal /100g)
                </button>
              ))}
            </div>
          )}

          {selectedFood && (
            <div className="bxkr-card p-2 mb-3">
              <div>{selectedFood.name} ({selectedFood.brand})</div>
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
              <select className="form-select mb-1" value={meal} onChange={(e) => setMeal(e.target.value as any)}>
                {meals.map((m) => <option key={m}>{m}</option>)}
              </select>
              <div className="d-flex justify-content-between">
                <div>Calories: {scaledSelected?.calories}</div>
                <div>Protein: {scaledSelected?.protein}g</div>
                <div>Carbs: {scaledSelected?.carbs}g</div>
                <div>Fat: {scaledSelected?.fat}g</div>
              </div>
              <button className="btn btn-primary w-100 mt-2" onClick={addEntry} disabled={adding}>
                {adding ? "Adding…" : "Add to Today"}
              </button>
            </div>
          )}
        </div>

        {/* Meal logs */}
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
            <div key={m} className="mb-3">
              <h5>{m} ({mealTotals.calories} kcal)</h5>
              {entries.length === 0 && <div className="text-muted">No items</div>}
              {entries.map((e: any) => (
                <div key={e.id} className="d-flex justify-content-between mb-1 bxkr-card p-2 align-items-center">
                  <div>{e.portionLabel || e.grams + "g"} {e.food.name}</div>
                  <div className="text-end">
                    {e.calories} kcal • {e.protein}p • {e.carbs}c • {e.fat}f
                    <button className="btn btn-link btn-sm text-danger ms-2" onClick={() => removeEntry(e.id)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}

      </main>
      <BottomNav />
    </>
  );
}