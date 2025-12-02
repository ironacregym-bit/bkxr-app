"use client";

import Head from "next/head";
import { useState, useEffect, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { useSession, signIn } from "next-auth/react";
import BottomNav from "../components/BottomNav";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Helpers
function gramsToFactor(g: number) {
  return g / 100;
}

export default function NutritionPage() {
  const { data: session, status } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [selectedFood, setSelectedFood] = useState<any | null>(null);
  const [grams, setGrams] = useState<number>(100);
  const [adding, setAdding] = useState(false);
  const [addingMeal, setAddingMeal] = useState<string | null>(null);
  const [portionLabel, setPortionLabel] = useState<string>("");

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const { data: logsData } = useSWR(
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

  const meals = ["Breakfast", "Lunch", "Dinner", "Snack"];

  // --- Add Entry ---
  const addEntry = async () => {
    if (!session?.user?.email || !selectedFood || !addingMeal) return signIn("google");
    setAdding(true);

    const factor = gramsToFactor(grams);
    const payload = {
      date: todayKey,
      meal: addingMeal,
      food: selectedFood,
      grams,
      portionLabel: portionLabel || null,
      calories: Math.round((selectedFood.calories || 0) * factor),
      protein: +( (selectedFood.protein || 0) * factor ).toFixed(1),
      carbs: +( (selectedFood.carbs || 0) * factor ).toFixed(1),
      fat: +( (selectedFood.fat || 0) * factor ).toFixed(1),
    };

    const optimisticEntry = {
      id: `temp-${Date.now()}`,
      created_at: new Date().toISOString(),
      ...payload,
    };

    mutate(
      `/api/nutrition/logs?date=${todayKey}`,
      (data: any) => ({
        entries: [optimisticEntry, ...(data?.entries || [])],
      }),
      false
    );

    try {
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
      setPortionLabel("");
      setAddingMeal(null);
    } catch (err) {
      console.error(err);
      mutate(`/api/nutrition/logs?date=${todayKey}`);
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
      <Head>
        <title>Nutrition — BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-3" style={{ paddingBottom: "90px" }}>
        <h2 className="mb-3 text-center">Nutrition</h2>

        {/* Macro Tiles */}
        <div className="d-flex justify-content-around mb-3">
          <div className="bxkr-tile">
            <div>🔥</div>
            <div>Calories</div>
            <div className="fw-bold">{totals.calories}</div>
          </div>
          <div className="bxkr-tile">
            <div>🍗</div>
            <div>Protein</div>
            <div className="fw-bold">{totals.protein}g</div>
          </div>
          <div className="bxkr-tile">
            <div>🍞</div>
            <div>Carbs</div>
            <div className="fw-bold">{totals.carbs}g</div>
          </div>
          <div className="bxkr-tile">
            <div>🥑</div>
            <div>Fat</div>
            <div className="fw-bold">{totals.fat}g</div>
          </div>
        </div>

        {meals.map((meal) => {
          const mealEntries = logsData?.entries?.filter((e: any) => e.meal === meal) || [];
          return (
            <div key={meal} className="mb-4">
              <h5>{meal}</h5>
              {mealEntries.length === 0 && <div className="text-muted mb-2">No entries yet.</div>}

              {mealEntries.map((e: any) => (
                <div key={e.id} className="d-flex align-items-center justify-content-between mb-2 bxkr-card p-2">
                  <div className="d-flex align-items-center gap-2">
                    {e.food.image && <img src={e.food.image} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }} />}
                    <div>
                      <div className="fw-bold">{e.food.name}</div>
                      <div className="small text-muted">{e.grams}g {e.portionLabel || ""}</div>
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="fw-bold">{e.calories} kcal</div>
                    <div className="small text-muted">{e.protein}p • {e.carbs}c • {e.fat}f</div>
                    <button className="btn btn-link btn-sm text-danger mt-1" onClick={() => removeEntry(e.id)}>Remove</button>
                  </div>
                </div>
              ))}

              <button className="btn btn-outline-primary btn-sm mt-2" onClick={() => setAddingMeal(meal)}>
                + Add Food
              </button>
            </div>
          );
        })}

        {/* Food search / manual entry */}
        {addingMeal && (
          <div className="bxkr-card p-3 mb-4">
            <h6>Add Food to {addingMeal}</h6>
            <input
              className="form-control mb-2"
              placeholder="Search foods..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {loadingSearch && <div className="text-muted mb-2">Searching…</div>}
            {results.length > 0 && (
              <div className="list-group mb-2">
                {results.slice(0, 10).map((f: any) => (
                  <button key={f.id} className="list-group-item list-group-item-action" onClick={() => setSelectedFood(f)}>
                    <div className="d-flex align-items-center">
                      {f.image && <img src={f.image} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, marginRight: 8 }} />}
                      <div>
                        <div className="fw-bold">{f.name}</div>
                        <div className="small text-muted">{f.brand || ""}</div>
                      </div>
                      <div className="ms-auto small">{f.calories ? `${Math.round(f.calories)} kcal /100g` : "-"}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected food card */}
            {selectedFood && (
              <div className="bxkr-card p-3 mb-2">
                <div className="mb-2 fw-bold">{selectedFood.name}</div>
                <div className="mb-2 small text-muted">{selectedFood.brand || ""}</div>
                <div className="mb-2">
                  <label className="form-label small">Portion / Quantity</label>
                  <input className="form-control mb-1" placeholder="e.g., 100g or 1 medium" value={portionLabel} onChange={(e) => setPortionLabel(e.target.value)} />
                  <input type="number" className="form-control" value={grams} onChange={(e) => setGrams(Number(e.target.value || 0))} />
                </div>
                <button className="btn btn-primary me-2" onClick={addEntry} disabled={adding}>{adding ? "Adding…" : "Add"}</button>
                <button className="btn btn-outline-secondary" onClick={() => { setAddingMeal(null); setSelectedFood(null); }}>Cancel</button>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}