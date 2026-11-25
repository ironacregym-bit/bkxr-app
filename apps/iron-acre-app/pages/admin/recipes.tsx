
// pages/admin/recipes.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useMemo, useState } from "react";
import BottomNav from "../../components/BottomNav";

type Recipe = {
  id?: string;
  title: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  image?: string | null;
  servings: number;
  per_serving: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    [k: string]: any;
  };
  ingredients: { name: string; qty: number; unit: string }[];
  instructions: string[];
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

export default function AdminRecipes() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";
  const authed = status === "authenticated" && (role === "admin" || role === "gym");

  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Single form state
  const [r, setR] = useState<Recipe>({
    title: "",
    meal_type: "breakfast",
    image: "",
    servings: 1,
    per_serving: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    ingredients: [{ name: "", qty: 0, unit: "g" }],
    instructions: [""],
  });

  // Bulk JSON
  const [bulk, setBulk] = useState<string>("");
  const [filter, setFilter] = useState<Recipe["meal_type"] | "all">("all");
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (filter !== "all") p.set("meal_type", filter);
    return `/api/recipes/list${p.toString() ? `?${p.toString()}` : ""}`;
  }, [filter]);

  const { data, mutate } = useSWR<{ recipes: Recipe[] }>(authed ? query : null, fetcher);
  const recipes = data?.recipes ?? [];

  if (status === "loading") {
    return <main className="container py-4"><div className="text-dim">Checking access…</div></main>;
  }
  if (!authed) {
    return (
      <>
        <main className="container py-4">
          <h3>Access denied</h3>
          <p>You need admin or gym role to manage recipes.</p>
          <Link href="/admin" className="btn-bxkr-outline">
            <i className="fas fa-arrow-left me-1" /> Back to Admin
          </Link>
        </main>
        <BottomNav />
      </>
    );
  }

  function updateIngredient(i: number, key: "name" | "qty" | "unit", val: string) {
    const next = [...r.ingredients];
    if (key === "qty") (next[i] as any)[key] = Number(val) || 0;
    else (next[i] as any)[key] = val;
    setR({ ...r, ingredients: next });
  }

  function updateInstruction(i: number, val: string) {
    const next = [...r.instructions];
    next[i] = val;
    setR({ ...r, instructions: next });
  }

  async function saveOne() {
    setBusy(true); setMsg(null);
    try {
      if (!r.title.trim()) throw new Error("Title required");
      if (!["breakfast","lunch","dinner","snack"].includes(r.meal_type)) throw new Error("Meal type invalid");
      if (!Number.isFinite(r.servings) || r.servings <= 0) throw new Error("Servings must be > 0");
      if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) throw new Error("At least 1 ingredient");
      if (r.ingredients.length > 6) throw new Error("Max 6 ingredients");

      const clean: Recipe = {
        ...r,
        image: r.image?.trim() ? r.image : null,
        ingredients: r.ingredients
          .filter(i => i.name.trim())
          .map(i => ({ name: i.name.trim(), qty: Number(i.qty) || 0, unit: i.unit.trim() || "g" })),
        instructions: r.instructions.map(s => s.trim()).filter(Boolean),
        per_serving: {
          calories: Number(r.per_serving?.calories || 0),
          protein_g: Number(r.per_serving?.protein_g || 0),
          carbs_g: Number(r.per_serving?.carbs_g || 0),
          fat_g: Number(r.per_serving?.fat_g || 0),
        },
      };

      const res = await fetch("/api/recipes/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe: clean }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to save");
      setMsg("Recipe saved ✅");
      mutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function importBulk() {
    setBusy(true); setMsg(null);
    try {
      const arr = JSON.parse(bulk || "[]");
      if (!Array.isArray(arr)) throw new Error("JSON must be an array");
      if (arr.length === 0) throw new Error("No items in JSON");

      const res = await fetch("/api/recipes/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipes: arr }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Bulk import failed");
      setMsg(`Imported ${j?.inserted ?? 0} / ${arr.length} ✅`);
      setBulk("");
      mutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this recipe?")) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/recipes/delete", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Delete failed");
      setMsg("Deleted ✅"); mutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head><title>Recipes • Admin</title></Head>
      <main className="container" style={{ paddingBottom: 90 }}>
        {/* Header / Back */}
        <section className="futuristic-card p-3 mb-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 8 }}>
            <div className="d-flex align-items-center gap-2">
              <Link href="/admin" className="btn-bxkr-outline">
                <i className="fas fa-arrow-left me-1" /> Back
              </Link>
              <h4 className="m-0">Recipes</h4>
            </div>
            <div className="d-flex gap-2">
              <button className="btn-bxkr-outline" aria-pressed={filter==="all"} onClick={() => setFilter("all")}>All</button>
              <button className="btn-bxkr-outline" aria-pressed={filter==="breakfast"} onClick={() => setFilter("breakfast")}>Breakfast</button>
              <button className="btn-bxkr-outline" aria-pressed={filter==="lunch"} onClick={() => setFilter("lunch")}>Lunch</button>
              <button className="btn-bxkr-outline" aria-pressed={filter==="dinner"} onClick={() => setFilter("dinner")}>Dinner</button>
              <button className="btn-bxkr-outline" aria-pressed={filter==="snack"} onClick={() => setFilter("snack")}>Snacks</button>
            </div>
          </div>
          {msg && <div className={`alert ${msg.includes("✅") ? "alert-success" : "alert-info"} mt-2`}>{msg}</div>}
        </section>

        {/* Add single */}
        <section className="futuristic-card p-3 mb-3">
          <h6 className="mb-2">Add / Edit Recipe</h6>
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label className="form-label">Title</label>
              <input className="form-control" value={r.title} onChange={e => setR({ ...r, title: e.target.value })} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">Meal type</label>
              <select className="form-select" value={r.meal_type} onChange={e => setR({ ...r, meal_type: e.target.value as any })}>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">Servings</label>
              <input type="number" className="form-control" value={r.servings} onChange={e => setR({ ...r, servings: Number(e.target.value) || 1 })} />
            </div>
            <div className="col-12">
              <label className="form-label">Image URL (optional)</label>
              <input className="form-control" value={r.image || ""} onChange={e => setR({ ...r, image: e.target.value })} placeholder="https://…" />
            </div>

            {/* Macros */}
            <div className="col-12">
              <div className="row g-2">
                <div className="col-6 col-md-3">
                  <label className="form-label">Calories</label>
                  <input type="number" className="form-control" value={r.per_serving.calories ?? 0} onChange={e => setR({ ...r, per_serving: { ...r.per_serving, calories: Number(e.target.value) || 0 } })} />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label">Protein (g)</label>
                  <input type="number" className="form-control" value={r.per_serving.protein_g ?? 0} onChange={e => setR({ ...r, per_serving: { ...r.per_serving, protein_g: Number(e.target.value) || 0 } })} />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label">Carbs (g)</label>
                  <input type="number" className="form-control" value={r.per_serving.carbs_g ?? 0} onChange={e => setR({ ...r, per_serving: { ...r.per_serving, carbs_g: Number(e.target.value) || 0 } })} />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label">Fat (g)</label>
                  <input type="number" className="form-control" value={r.per_serving.fat_g ?? 0} onChange={e => setR({ ...r, per_serving: { ...r.per_serving, fat_g: Number(e.target.value) || 0 } })} />
                </div>
              </div>
            </div>

            {/* Ingredients (≤6) */}
            <div className="col-12">
              <label className="form-label">Ingredients (max 6)</label>
              {r.ingredients.map((ing, i) => (
                <div className="d-flex gap-2 mb-2" key={i}>
                  <input className="form-control" placeholder="Name" value={ing.name} onChange={e => updateIngredient(i, "name", e.target.value)} />
                  <input type="number" className="form-control" placeholder="Qty" value={ing.qty} onChange={e => updateIngredient(i, "qty", e.target.value)} />
                  <input className="form-control" placeholder="Unit" value={ing.unit} onChange={e => updateIngredient(i, "unit", e.target.value)} />
                  <button className="btn-bxkr-outline" type="button" onClick={() => setR({ ...r, ingredients: r.ingredients.filter((_, idx) => idx !== i) })}>Remove</button>
                </div>
              ))}
              {r.ingredients.length < 6 && (
                <button type="button" className="btn-bxkr-outline" onClick={() => setR({ ...r, ingredients: [...r.ingredients, { name: "", qty: 0, unit: "g" }] })}>
                  + Ingredient
                </button>
              )}
            </div>

            {/* Instructions */}
            <div className="col-12">
              <label className="form-label">Instructions</label>
              {r.instructions.map((step, i) => (
                <div className="d-flex gap-2 mb-2" key={i}>
                  <input className="form-control" placeholder={`Step ${i + 1}`} value={step} onChange={e => updateInstruction(i, e.target.value)} />
                  <button className="btn-bxkr-outline" type="button" onClick={() => setR({ ...r, instructions: r.instructions.filter((_, idx) => idx !== i) })}>Remove</button>
                </div>
              ))}
              <button type="button" className="btn-bxkr-outline" onClick={() => setR({ ...r, instructions: [...r.instructions, ""] })}>+ Step</button>
            </div>

            <div className="col-12">
              <button className="btn-bxkr" onClick={saveOne} type="button" disabled={busy}>
                {busy ? "Saving…" : "Save Recipe"}
              </button>
            </div>
          </div>
        </section>

        {/* Bulk JSON */}
        <section className="futuristic-card p-3 mb-3">
          <h6 className="mb-2">Bulk import (JSON array)</h6>
          <textarea
            className="form-control"
            rows={10}
            value={bulk}
            onChange={e => setBulk(e.target.value)}
            placeholder='[ { "title": "Greek Yogurt & Berries", "meal_type":"breakfast", ... }, ... ]'
          />
          <div className="mt-2 d-flex gap-2">
            <button className="btn-bxkr" onClick={importBulk} disabled={busy}>
              {busy ? "Importing…" : "Import JSON"}
            </button>
          </div>
          <div className="text-dim mt-2" style={{ fontSize: 13 }}>
            Max 6 ingredients per recipe. Macros should be per serving. Paste the seed JSON we provided to load items quickly.
          </div>
        </section>

        {/* Minimal list */}
        <section className="futuristic-card p-3">
          <h6 className="mb-2">Existing recipes ({recipes.length})</h6>
          {recipes.length === 0 ? (
            <div className="text-dim">No recipes yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="bxkr-table">
                <thead>
                  <tr><th>Meal</th><th>Title</th><th>kcal</th><th>P</th><th>C</th><th>F</th><th></th></tr>
                </thead>
                <tbody>
                  {recipes.map((x) => (
                    <tr key={x.id || x.title}>
                      <td className="text-capitalize">{x.meal_type}</td>
                      <td>{x.title}</td>
                      <td>{Math.round(x.per_serving?.calories || 0)}</td>
                      <td>{Math.round(x.per_serving?.protein_g || 0)}</td>
                      <td>{Math.round(x.per_serving?.carbs_g || 0)}</td>
                      <td>{Math.round(x.per_serving?.fat_g || 0)}</td>
                      <td>
                        <button className="btn-bxkr-outline" onClick={() => x.id && del(x.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </>
  );
}
