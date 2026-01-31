"use client";

import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "../../components/BottomNav";

type DayName = "Sunday"|"Monday"|"Tuesday"|"Wednesday"|"Thursday"|"Friday"|"Saturday";
type MealType = "breakfast"|"lunch"|"dinner"|"snack";

type PlanItem = {
  day: DayName;
  meal_type: MealType;
  recipe_id: string;
  default_multiplier?: number;
  // local UI
  recipe_title?: string;
};

type Plan = {
  id?: string;
  title: string;
  tier: "free"|"premium";
  description?: string;
  image?: string | null;
  items: PlanItem[];
};

type PlanSummary = { id: string; title: string; tier: "free"|"premium"; description?: string|null; image?: string|null; locked?: boolean };

type RecipeSummary = {
  id: string;
  title: string;
  meal_type: MealType;
  image?: string | null;
  per_serving?: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number };
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";
const DAYS: DayName[] = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MEALS: MealType[] = ["breakfast","lunch","dinner","snack"];

export default function AdminMealPlans() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";
  const authed = status === "authenticated" && (role === "admin" || role === "gym");

  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Filters for library
  const [tierFilter, setTierFilter] = useState<"all"|"free"|"premium">("all");
  const plansKey = authed ? `/api/mealplan/library/list${tierFilter==="all" ? "" : `?tier=${tierFilter}`}` : null;
  const { data: plansResp, mutate: mutatePlans } = useSWR<{ plans: PlanSummary[] }>(plansKey, fetcher, { revalidateOnFocus: false, dedupingInterval: 20_000 });
  const plans = useMemo(() => plansResp?.plans || [], [plansResp]);

  // Recipes (for picker)
  const [recipeFilter, setRecipeFilter] = useState<MealType | "all">("all");
  const [recipeQ, setRecipeQ] = useState<string>("");
  const recipeQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (recipeFilter !== "all") p.set("meal_type", recipeFilter);
    if (recipeQ.trim()) p.set("q", recipeQ.trim());
    p.set("limit", "200");
    return `/api/recipes/list${p.toString() ? `?${p.toString()}` : ""}`;
  }, [recipeFilter, recipeQ]);
  const { data: recipesResp } = useSWR<{ recipes: RecipeSummary[] }>(authed ? recipeQuery : null, fetcher, { revalidateOnFocus: false, dedupingInterval: 20_000 });
  const recipes = useMemo(() => recipesResp?.recipes || [], [recipesResp]);

  // Single plan form
  const [p, setP] = useState<Plan>({
    title: "",
    tier: "free",
    description: "",
    image: "",
    items: [],
  });

  // Bulk JSON import
  const [bulk, setBulk] = useState<string>("");

  useEffect(() => {
    if (status === "loading") setMsg(null);
  }, [status]);

  if (status === "loading") {
    return <main className="container py-4"><div className="text-dim">Checking access…</div></main>;
  }
  if (!authed) {
    return (
      <>
        <main className="container py-4">
          <h3>Access denied</h3>
          <p>You need admin or gym role to manage meal plans.</p>
          <Link href="/admin" className="btn-bxkr-outline"><i className="fas fa-arrow-left me-1" /> Back to Admin</Link>
        </main>
        <BottomNav />
      </>
    );
  }

  function addItem() {
    setP((prev) => ({
      ...prev,
      items: [...prev.items, { day: "Monday", meal_type: "dinner", recipe_id: "", default_multiplier: 1 }],
    }));
  }

  function updateItem(idx: number, patch: Partial<PlanItem>) {
    setP((prev) => {
      const next = [...prev.items];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, items: next };
    });
  }

  function removeItem(idx: number) {
    setP((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  }

  function loadForEdit(planId: string) {
    setBusy(true); setMsg(null);
    fetch(`/api/mealplan/library/get?plan_id=${encodeURIComponent(planId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j?.id) throw new Error("Plan not found");
        const items: PlanItem[] = Array.isArray(j.items) ? j.items.map((it: any) => ({
          day: it.day,
          meal_type: it.meal_type,
          recipe_id: it.recipe_id,
          default_multiplier: it.default_multiplier != null ? Number(it.default_multiplier) : undefined,
        })) : [];
        setP({
          id: j.id,
          title: j.title || "Meal Plan",
          tier: (j.tier || "free") === "premium" ? "premium" : "free",
          description: j.description || "",
          image: j.image || "",
          items,
        });
        setMsg(`Loaded "${j.title}" for editing`);
      })
      .catch((e) => setMsg(e?.message || "Failed to load plan"))
      .finally(() => setBusy(false));
  }

  async function saveOne() {
    setBusy(true); setMsg(null);
    try {
      if (!p.title.trim()) throw new Error("Title required");
      if (!["free","premium"].includes(p.tier)) throw new Error("Tier invalid");
      if (!Array.isArray(p.items) || p.items.length === 0) throw new Error("At least one item required");
      for (const [i, it] of p.items.entries()) {
        if (!it.recipe_id) throw new Error(`Item ${i+1}: recipe required`);
        if (!DAYS.includes(it.day)) throw new Error(`Item ${i+1}: day invalid`);
        if (!MEALS.includes(it.meal_type)) throw new Error(`Item ${i+1}: meal type invalid`);
        const m = it.default_multiplier != null ? Number(it.default_multiplier) : 1;
        if (!Number.isFinite(m) || m <= 0) throw new Error(`Item ${i+1}: multiplier must be > 0`);
      }
      const clean: Plan = {
        id: p.id,
        title: p.title.trim(),
        tier: p.tier,
        description: p.description?.trim() || "",
        image: p.image?.trim() || "",
        items: p.items.map((it) => ({
          day: it.day,
          meal_type: it.meal_type,
          recipe_id: it.recipe_id,
          default_multiplier: it.default_multiplier != null ? Number(it.default_multiplier) : 1,
        })),
      };
      const r = await fetch("/api/mealplan/library/upsert", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: clean }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to save");
      setMsg(clean.id ? "Plan updated ✅" : "Plan created ✅");
      setP((prev) => ({ ...prev, id: j.id || prev.id }));
      mutatePlans();
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function importBulk() {
    setBusy(true); setMsg(null);
    try {
      const json = JSON.parse(bulk || "[]");
      const payload = Array.isArray(json) ? json : [json];
      if (!payload.length) throw new Error("No items in JSON");
      const r = await fetch("/api/mealplan/library/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plans: payload }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Bulk import failed");
      setMsg(`Imported ${j?.inserted ?? 0} item(s) ✅`);
      setBulk("");
      mutatePlans();
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function delPlan(id: string) {
    if (!confirm("Delete this plan? Existing assignments/materialised items will not be removed.")) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/mealplan/library/delete", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Delete failed");
      setMsg("Deleted ✅");
      if (p.id === id) setP({ title: "", tier: "free", description: "", image: "", items: [] });
      mutatePlans();
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head><title>Meal Plans • Admin</title></Head>
      <main className="container" style={{ paddingBottom: 90 }}>
        {/* Header */}
        <section className="futuristic-card p-3 mb-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 8 }}>
            <div className="d-flex align-items-center gap-2">
              <Link href="/admin" className="btn-bxkr-outline"><i className="fas fa-arrow-left me-1" /> Back</Link>
              <h4 className="m-0">Meal Plans</h4>
            </div>
            <div className="d-flex gap-2">
              <button className="btn-bxkr-outline" aria-pressed={tierFilter==="all"} onClick={() => setTierFilter("all")}>All</button>
              <button className="btn-bxkr-outline" aria-pressed={tierFilter==="free"} onClick={() => setTierFilter("free")}>Free</button>
              <button className="btn-bxkr-outline" aria-pressed={tierFilter==="premium"} onClick={() => setTierFilter("premium")}>Premium</button>
            </div>
          </div>
          {msg && <div className={`alert ${msg.includes("✅") ? "alert-success" : "alert-info"} mt-2`}>{msg}</div>}
        </section>

        {/* Create/Edit form */}
        <section className="futuristic-card p-3 mb-3">
          <h6 className="mb-2">{p.id ? "Edit Meal Plan" : "Create Meal Plan"}</h6>
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label className="form-label">Title</label>
              <input className="form-control" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">Tier</label>
              <select className="form-select" value={p.tier} onChange={(e) => setP({ ...p, tier: e.target.value as any })}>
                <option value="free">Free</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label">Image URL (optional)</label>
              <input className="form-control" value={p.image || ""} onChange={(e) => setP({ ...p, image: e.target.value })} placeholder="https://…" />
            </div>
            <div className="col-12">
              <label className="form-label">Description</label>
              <textarea className="form-control" rows={2} value={p.description || ""} onChange={(e) => setP({ ...p, description: e.target.value })} />
            </div>

            {/* Items Builder */}
            <div className="col-12">
              <div className="d-flex align-items-center justify-content-between mb-1">
                <label className="form-label m-0">Items</label>
                <button type="button" className="btn-bxkr-outline" onClick={addItem}>+ Item</button>
              </div>

              <div className="table-responsive">
                <table className="bxkr-table">
                  <thead>
                    <tr><th>Day</th><th>Meal</th><th>Recipe</th><th>Multiplier</th><th /></tr>
                  </thead>
                  <tbody>
                    {p.items.length === 0 && (
                      <tr><td colSpan={5}><div className="text-dim">No items. Add one.</div></td></tr>
                    )}
                    {p.items.map((it, i) => {
                      // Filter recipes optionally by meal type to keep dropdown short
                      const filtered = recipes.filter(r => recipeFilter==="all" ? true : r.meal_type === recipeFilter);
                      return (
                        <tr key={i}>
                          <td style={{ minWidth: 140 }}>
                            <select className="form-select" value={it.day} onChange={(e) => updateItem(i, { day: e.target.value as DayName })}>
                              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </td>
                          <td style={{ minWidth: 140 }}>
                            <select
                              className="form-select"
                              value={it.meal_type}
                              onChange={(e) => updateItem(i, { meal_type: e.target.value as MealType })}
                            >
                              {MEALS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                          </td>
                          <td style={{ minWidth: 300 }}>
                            <div className="d-flex gap-2">
                              <select
                                className="form-select"
                                value={it.recipe_id}
                                onChange={(e) => {
                                  const rid = e.target.value;
                                  const rec = recipes.find(r => r.id === rid);
                                  updateItem(i, { recipe_id: rid, recipe_title: rec?.title });
                                }}
                              >
                                <option value="">— Select recipe —</option>
                                {filtered.map(r => (
                                  <option key={r.id} value={r.id}>
                                    {r.title} • {r.meal_type} • {Math.round(r.per_serving?.calories || 0)} kcal
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td style={{ width: 140 }}>
                            <input
                              type="number" min={0.25} step={0.25}
                              className="form-control"
                              value={it.default_multiplier ?? 1}
                              onChange={(e) => updateItem(i, { default_multiplier: Number(e.target.value) || 1 })}
                              placeholder="1"
                            />
                          </td>
                          <td>
                            <button type="button" className="btn-bxkr-outline" onClick={() => removeItem(i)}>Remove</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Recipe filters (assist the dropdowns) */}
              <div className="d-flex align-items-end gap-2 mt-2 flex-wrap">
                <div>
                  <label className="form-label">Recipe filter</label>
                  <select className="form-select" value={recipeFilter} onChange={(e) => setRecipeFilter(e.target.value as any)}>
                    <option value="all">All</option>
                    {MEALS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div style={{ minWidth: 200, flex: 1 }}>
                  <label className="form-label">Search recipes</label>
                  <input className="form-control" value={recipeQ} onChange={(e) => setRecipeQ(e.target.value)} placeholder="e.g., chicken, oats" />
                </div>
              </div>
            </div>

            <div className="col-12">
              <button className="btn-bxkr" onClick={saveOne} type="button" disabled={busy}>
                {busy ? "Saving…" : (p.id ? "Update Meal Plan" : "Create Meal Plan")}
              </button>
            </div>
          </div>
        </section>

        {/* Bulk JSON */}
        <section className="futuristic-card p-3 mb-3">
          <h6 className="mb-2">JSON quick create</h6>
          <textarea
            className="form-control"
            rows={10}
            value={bulk}
            onChange={e => setBulk(e.target.value)}
            placeholder='{"title":"BXKR Starter (Free)","tier":"free","description":"Simple high-protein week","items":[{"day":"Monday","meal_type":"breakfast","recipe_id":"<id>","default_multiplier":1},{"day":"Monday","meal_type":"dinner","recipe_id":"<id>"}]}'
          />
          <div className="mt-2 d-flex gap-2">
            <button className="btn-bxkr" onClick={importBulk} disabled={busy}>
              {busy ? "Importing…" : "Import JSON"}
            </button>
          </div>
          <div className="text-dim mt-2" style={{ fontSize: 13 }}>
            Paste a single object or an array of plan objects. Items require valid day/meal_type and recipe_id.
          </div>
        </section>

        {/* Existing plans */}
        <section className="futuristic-card p-3">
          <h6 className="mb-2">Existing plans ({plans.length})</h6>
          {plans.length === 0 ? (
            <div className="text-dim">No plans yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="bxkr-table">
                <thead><tr><th>Tier</th><th>Title</th><th>Description</th><th /></tr></thead>
                <tbody>
                  {plans.map(pl => (
                    <tr key={pl.id}>
                      <td className="text-capitalize">{pl.tier}</td>
                      <td>{pl.title}</td>
                      <td className="text-dim">{pl.description || ""}</td>
                      <td className="text-nowrap">
                        <button className="btn-bxkr-outline me-2" onClick={() => loadForEdit(pl.id)}>Load</button>
                        <button className="btn-bxkr-outline" onClick={() => delPlan(pl.id)}>Delete</button>
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
