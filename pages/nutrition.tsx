"use client";

import Head from "next/head";
import { useState, useEffect, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { useSession, signIn } from "next-auth/react";
import BottomNav from "../components/BottomNav";

// Inline debounce to avoid dependency errors
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

const fetcher = (u: string) => fetch(u).then((r) => r.json());

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

  // Today's date key
  const todayKey = useMemo(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }, []);

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
          setLoadingSearch(false);
          return;
        }
        setLoadingSearch(true);
        try {
          const res = await fetch(`/api/foods/search?query=${encodeURIComponent(q)}`);
          const json = await res.json();
          setResults(json.foods || []);
        } catch (err) {
          console.error(err);
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

  // Compute scaled nutrition for selected grams
  const scaledSelected = useMemo(() => {
    if (!selectedFood) return null;
    const factor = gramsToFactor(grams);
    return {
      ...selectedFood,
      calories: Math.round((selectedFood.calories || 0) * factor),
      protein: +( (selectedFood.protein || 0) * factor ).toFixed(1),
      carbs: +( (selectedFood.carbs || 0) * factor ).toFixed(1),
      fat: +( (selectedFood.fat || 0) * factor ).toFixed(1),
    };
  }, [selectedFood, grams]);

  // Add entry
  const addEntry = async () => {
    if (!session?.user?.email || !selectedFood) {
      return signIn("google");
    }
    setAdding(true);
    try {
      const payload = {
        date: todayKey,
        food: selectedFood,
        grams,
        calories: scaledSelected.calories,
        protein: scaledSelected.protein,
        carbs: scaledSelected.carbs,
        fat: scaledSelected.fat,
      };
      // Optimistic update
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

      const res = await fetch("/api/nutrition/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to save");
      }

      // Revalidate
      mutate(`/api/nutrition/logs?date=${todayKey}`);
      setSelectedFood(null);
      setQuery("");
      setResults([]);
      setGrams(100);
    } catch (err) {
      console.error(err);
      // revalidate to correct optimistic failure
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
        <link relName="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </Head>

      <main className="container py-3" style={{ paddingBottom: "90px" }}>
        <h2 className="mb-3 text-center">Nutrition</h2>

        {/* Totals quick view */}
        <div className="row text-center mb-3 gx-2">
          <div className="col">
            <div className="bxkr-card py-2">
              <div className="bxkr-stat-label"><i className="fas fa-fire bxkr-icon bxkr-icon-orange-gradient me-1" />Calories</div>
              <div className="bxkr-stat-value">{totals.calories}</div>
              <div className="small text-muted">Today</div>
            </div>
          </div>
          <div className="col">
            <div className="bxkr-card py-2">
              <div className="bxkr-stat-label"><i className="fas fa-drumstick-bite bxkr-icon me-1" />Protein</div>
              <div className="bxkr-stat-value">{totals.protein}g</div>
              <div className="small text-muted">Today</div>
            </div>
          </div>
          <div className="col">
            <div className="bxkr-card py-2">
              <div className="bxkr-stat-label"><i className="fas fa-bread-slice bxkr-icon me-1" />Carbs</div>
              <div className="bxkr-stat-value">{totals.carbs}g</div>
              <div className="small text-muted">Today</div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-3">
          <label className="form-label">Search foods (OpenFoodFacts)</label>
          <input
            className="form-control"
            placeholder="e.g. Tesco chicken sandwich, banana, chicken breast"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mt-2 small text-muted">Tip: search brand + product for packaged foods (barcodes returned when available)</div>

          {loadingSearch && <div className="mt-2">Searching…</div>}

          {results.length > 0 && (
            <div className="list-group mt-2">
              {results.slice(0, 10).map((f: any) => (
                <button
                  key={f.id ?? f.code ?? f.name}
                  className="list-group-item list-group-item-action"
                  onClick={() => {
                    setSelectedFood(f);
                    setGrams(100);
                  }}
                >
                  <div className="d-flex align-items-center">
                    {f.image && <img src={f.image} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, marginRight: 12 }} />}
                    <div style={{ flex: 1 }}>
                      <div className="fw-bold">{f.name}</div>
                      <div className="small text-muted">{f.brand || f.brands || ""}</div>
                    </div>
                    <div className="text-end small">
                      <div>{f.calories ? `${Math.round(f.calories)} kcal /100g` : "-"}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected food card */}
        {selectedFood && (
          <div className="bxkr-card p-3 mb-3">
            <div className="d-flex align-items-start gap-3">
              {selectedFood.image && <img src={selectedFood.image} alt="" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8 }} />}
              <div style={{ flex: 1 }}>
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h5 className="mb-1">{selectedFood.name}</h5>
                    <div className="small text-muted">{selectedFood.brand}</div>
                  </div>
                  <div className="text-end">
                    <div className="fw-bold">{selectedFood.calories ? `${selectedFood.calories} kcal /100g` : "-"}</div>
                    <div className="small text-muted">per 100g</div>
                  </div>
                </div>

                <div className="mt-3">
                  <label className="form-label small">Quantity (grams)</label>
                  <input type="number" className="form-control" value={grams} onChange={(e) => setGrams(Number(e.target.value || 0))} />
                </div>

                <div className="mt-3 d-flex justify-content-between">
                  <div>
                    <div className="small text-muted">Calories</div>
                    <div className="fw-bold">{scaledSelected?.calories ?? "-"} kcal</div>
                  </div>
                  <div>
                    <div className="small text-muted">Protein</div>
                    <div className="fw-bold">{scaledSelected?.protein ?? "-"} g</div>
                  </div>
                  <div>
                    <div className="small text-muted">Carbs</div>
                    <div className="fw-bold">{scaledSelected?.carbs ?? "-"} g</div>
                  </div>
                  <div>
                    <div className="small text-muted">Fat</div>
                    <div className="fw-bold">{scaledSelected?.fat ?? "-"} g</div>
                  </div>
                </div>

                <div className="mt-3 d-flex gap-2">
                  <button className="btn btn-primary" onClick={addEntry} disabled={adding}>
                    {adding ? "Adding…" : "Add to Today"}
                  </button>
                  <button className="btn btn-outline-secondary" onClick={() => setSelectedFood(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Today's log */}
        <div className="mb-5">
          <h5>Today&apos;s Log</h5>
          {logsError && <div className="alert alert-danger">Failed to load logs</div>}
          {!logsData ? (
            <div className="text-muted">Loading…</div>
          ) : logsData.entries.length === 0 ? (
            <div className="text-muted">No entries yet — add something above.</div>
          ) : (
            logsData.entries.map((e: any) => (
              <div key={e.id} className="d-flex align-items-center justify-content-between mb-2 bxkr-card p-2">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {e.food.image && <img src={e.food.image} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }} />}
                  <div>
                    <div className="fw-bold">{e.food.name}</div>
                    <div className="small text-muted">{e.grams} g • {e.food.brand || ""}</div>
                  </div>
                </div>

                <div className="text-end">
                  <div className="fw-bold">{e.calories} kcal</div>
                  <div className="small text-muted">{e.protein}p • {e.carbs}c • {e.fat}f</div>
                  <div className="mt-1">
                    <button className="btn btn-link btn-sm text-danger" onClick={() => removeEntry(e.id)}>Remove</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      <BottomNav />
    </>
  );
}