
// pages/recipes/index.tsx
"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "../../components/BottomNav";

type Recipe = {
  id: string;
  title: string;
  meal_type: "breakfast"|"lunch"|"dinner"|"snack";
  image?: string|null;
  per_serving?: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number; [k: string]: any };
};

type PlanItem = {
  id: string;
  title: string;
  meal_type: Recipe["meal_type"];
  image?: string|null;
  multiplier: number;
  per_serving: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number; [k: string]: any };
  scaled: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number; [k: string]: any };
};

type PlanGet = {
  items: PlanItem[];
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  targets: { calories: number; protein_g: number; carbs_g: number; fat_g: number } | null;
};

const fetcher = (u: string) => fetch(u).then(r => r.json());

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function MacroRow({ label, val, target, unit = "" }: { label: string; val: number; target?: number|null; unit?: string }) {
  const pct = target ? Math.min(100, Math.round((val / target) * 100)) : 0;
  return (
    <div className="mb-2">
      <div className="d-flex justify-content-between">
        <span className="text-dim">{label}</span>
        <span>{Math.round(val)}{unit}{target ? ` / ${Math.round(target)}${unit}` : ""}</span>
      </div>
      {target ? (
        <div className="capacity">
          <div className="bar"><span style={{ width: `${pct}%` }} /></div>
        </div>
      ) : null}
    </div>
  );
}

export default function RecipesPage() {
  const { status } = useSession();
  const authed = status === "authenticated";

  // UI state
  const [mealType, setMealType] = useState<Recipe["meal_type"]>("breakfast");
  const [q, setQ] = useState("");
  const [date, setDate] = useState(todayYMD());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Data
  const { data: recipesData, mutate: recipesMutate } = useSWR<{ recipes: Recipe[] }>(
    authed ? `/api/recipes/list?meal_type=${mealType}&q=${encodeURIComponent(q)}` : null,
    fetcher
  );
  const recipes = useMemo(() => recipesData?.recipes || [], [recipesData]);

  const { data: planData, mutate: planMutate } = useSWR<PlanGet>(
    authed ? `/api/mealplan/get?date=${date}` : null,
    fetcher
  );

  const totals = planData?.totals || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const targets = planData?.targets || null;

  useEffect(() => { setMsg(null); }, [mealType, q, date]);

  async function addRecipe(r: Recipe, autoScale: boolean) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/mealplan/add", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ date, recipeId: r.id, meal_type: r.meal_type, autoScale }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to add");
      setMsg(`Added ${r.title}${autoScale ? " (auto‑scaled)" : ""}`);
      planMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to add");
    } finally {
      setBusy(false);
    }
  }

  async function updateMultiplier(item: PlanItem, newMul: number) {
    if (newMul <= 0) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/mealplan/update", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ date, itemId: item.id, multiplier: newMul }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to update portion");
      planMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(item: PlanItem) {
    if (!confirm(`Remove "${item.title}" from plan?`)) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/mealplan/remove", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ date, itemId: item.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to remove");
      planMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to remove");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head><title>BXKR • Recipes</title></Head>

      <main className="container" style={{ paddingBottom: 90, minHeight: "80vh" }}>
        {/* Header toolbar */}
        <section className="bxkr-card p-3 mb-3">
          <div className="d-flex flex-wrap align-items-center gap-2 justify-content-between">
            <div className="d-flex gap-2">
              {(["breakfast","lunch","dinner","snack"] as const).map(mt => (
                <button
                  key={mt}
                  className="btn-bxkr-outline"
                  aria-pressed={mealType === mt}
                  onClick={() => setMealType(mt)}
                >
                  {mt[0].toUpperCase() + mt.slice(1)}
                </button>
              ))}
            </div>
            <div className="d-flex gap-2">
              <input
                className="form-control"
                placeholder="Search recipes…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ minWidth: 220 }}
              />
              <input
                className="form-control"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          {msg && <div className="alert alert-info mt-2">{msg}</div>}
        </section>

        {/* Summary card */}
        <section className="bxkr-card p-3 mb-3">
          <h5 className="mb-2">Today’s Plan</h5>
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <MacroRow label="Calories" val={totals.calories} target={targets?.calories} />
              <MacroRow label="Protein"  val={totals.protein_g} target={targets?.protein_g} unit="g" />
              <MacroRow label="Carbs"    val={totals.carbs_g}   target={targets?.carbs_g}   unit="g" />
              <MacroRow label="Fat"      val={totals.fat_g}     target={targets?.fat_g}     unit="g" />
            </div>
            <div className="col-12 col-md-6">
              <div className="text-dim mb-1">Items</div>
              {!planData?.items?.length ? (
                <div className="text-dim">No items added yet.</div>
              ) : (
                <div className="table-responsive">
                  <table className="bxkr-table">
                    <thead>
                      <tr>
                        <th>Meal</th>
                        <th>Recipe</th>
                        <th>Servings</th>
                        <th>kcal</th>
                        <th>P</th>
                        <th>C</th>
                        <th>F</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {planData.items.map((it) => (
                        <tr key={it.id}>
                          <td className="text-capitalize">{it.meal_type}</td>
                          <td>{it.title}</td>
                          <td className="d-flex gap-1 align-items-center">
                            <button className="btn-bxkr-outline" onClick={() => updateMultiplier(it, Number((it.multiplier - 0.25).toFixed(2)))}>-</button>
                            <span style={{ minWidth: 48, textAlign: "center" }}>{it.multiplier.toFixed(2)}x</span>
                            <button className="btn-bxkr-outline" onClick={() => updateMultiplier(it, Number((it.multiplier + 0.25).toFixed(2)))}>+</button>
                          </td>
                          <td>{Math.round(it.scaled?.calories || 0)}</td>
                          <td>{Math.round(it.scaled?.protein_g || 0)}</td>
                          <td>{Math.round(it.scaled?.carbs_g || 0)}</td>
                          <td>{Math.round(it.scaled?.fat_g || 0)}</td>
                          <td>
                            <button className="btn-bxkr-outline" onClick={() => removeItem(it)}>Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Recipes grid */}
        <section className="mb-3">
          <div className="row g-2">
            {recipes.map(r => (
              <div key={r.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                <div className="bxkr-card p-2">
                  {r.image ? (
                    <img src={r.image} alt={r.title} style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 12 }} />
                  ) : (
                    <div className="text-dim" style={{ height: 140, display:"flex", alignItems:"center", justifyContent:"center", border:"1px solid var(--bxkr-card-border)", borderRadius: 12 }}>
                      No image
                    </div>
                  )}
                  <div className="mt-2">
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="fw-semibold">{r.title}</div>
                      <span className="bxkr-chip text-capitalize">{r.meal_type}</span>
                    </div>
                    <div className="text-dim" style={{ fontSize: 13 }}>
                      {Math.round(r.per_serving?.calories || 0)} kcal •
                      {" P"}{Math.round(r.per_serving?.protein_g || 0)} •
                      {" C"}{Math.round(r.per_serving?.carbs_g || 0)} •
                      {" F"}{Math.round(r.per_serving?.fat_g || 0)}
                    </div>
                    <div className="d-flex gap-2 mt-2">
                      <button className="btn-bxkr" onClick={() => addRecipe(r, true)} disabled={busy}>Add (Auto)</button>
                      <button className="btn-bxkr-outline" onClick={() => addRecipe(r, false)} disabled={busy}>Add 1x</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {!recipes.length && (
              <div className="text-dim">No recipes found. Adjust filters or add data to Firestore.</div>
            )}
          </div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}
