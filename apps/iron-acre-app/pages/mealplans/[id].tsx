"use client";

import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "../../components/BottomNav";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type PlanItem = { meal_type?: MealType; recipe_id: string; default_multiplier?: number };
type PlanDoc = { id: string; title: string; tier: "free" | "premium"; description?: string; image?: string | null; items: PlanItem[] };

type LibraryList = { plans: Array<{ id: string; tier: "free"|"premium" }>; isPremium: boolean };
type RecipeSummary = {
  id: string;
  title: string;
  meal_type: MealType;
  image?: string | null;
  per_serving?: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number };
};

type ShoppingListMeta = { id: string; name: string; created_at?: string; updated_at?: string };

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

function isYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function formatYMD(d: Date) {
  return d.toLocaleDateString("en-CA");
}

export default function MealPlanUserPage() {
  const router = useRouter();
  const { id } = router.query;
  const planId = typeof id === "string" ? id : "";

  const { data: session, status } = useSession();
  const authed = status === "authenticated";
  const email = (session?.user as any)?.email || "";

  // Plan
  const planKey = planId ? `/api/mealplan/library/get?plan_id=${encodeURIComponent(planId)}` : null;
  const { data: planResp, isValidating: loadingPlan } = useSWR<PlanDoc>(planKey, fetcher, { revalidateOnFocus: false });

  // Library list to know premium access
  const { data: listResp } = useSWR<LibraryList>(authed ? `/api/mealplan/library/list` : null, fetcher, { revalidateOnFocus: false });
  const isPremiumUser = !!listResp?.isPremium;
  const isPremiumPlan = (planResp?.tier || "free") === "premium";
  const locked = isPremiumPlan && !isPremiumUser;

  // Recipes pool (best-effort) to show titles/macros
  const recipesKey = authed ? `/api/recipes/list?limit=200` : null;
  const { data: recipesResp } = useSWR<{ recipes: RecipeSummary[] }>(recipesKey, fetcher, { revalidateOnFocus: false, dedupingInterval: 20_000 });
  const recipes = useMemo(() => recipesResp?.recipes || [], [recipesResp]);
  const recipeMap = useMemo(() => {
    const m = new Map<string, RecipeSummary>();
    (recipes || []).forEach((r) => m.set(r.id, r));
    return m;
  }, [recipes]);

  // Shopping lists (user may pick an existing one)
  const { data: listsResp, mutate: mutateLists } = useSWR<{ lists: ShoppingListMeta[] }>(
    authed ? `/api/shopping/lists` : null,
    fetcher,
    { revalidateOnFocus: false }
  );
  const lists = useMemo(() => listsResp?.lists || [], [listsResp]);

  // UI state
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Selection
  type RowState = { selected: boolean; multiplier: string };
  const [dateYMD, setDateYMD] = useState<string>("");
  const [rows, setRows] = useState<RowState[]>([]);
  const [tailor, setTailor] = useState<boolean>(false); // if true, use /api/mealplan/add autoScale
  const [household, setHousehold] = useState<number>(1);
  const [listId, setListId] = useState<string>(""); // optional existing list
  const [newListName, setNewListName] = useState<string>("");

  useEffect(() => {
    if (!dateYMD) setDateYMD(formatYMD(new Date()));
  }, [dateYMD]);

  useEffect(() => {
    if (planResp?.items) {
      setRows(planResp.items.map((it) => ({
        selected: true,
        multiplier: String(it.default_multiplier ?? 1),
      })));
    } else {
      setRows([]);
    }
  }, [planResp?.items]);

  if (status === "loading") {
    return <main className="container py-4"><div className="text-dim">Checking access…</div></main>;
  }
  if (!authed) {
    return (
      <>
        <main className="container py-4">
          <h3>Please sign in</h3>
          <p>You need to sign in to view and use meal plans.</p>
          <Link href="/" className="btn-bxkr-outline"><i className="fas fa-arrow-left me-1" /> Home</Link>
        </main>
        <BottomNav />
      </>
    );
  }

  const plan = planResp;

  // Derived totals for display (selected items only, using recipeMap if available)
  const selectedItems = useMemo(() => {
    const out: Array<{ item: PlanItem; row: RowState; recipe?: RecipeSummary }> = [];
    (plan?.items || []).forEach((it, idx) => {
      const row = rows[idx];
      if (!row?.selected) return;
      const rec = recipeMap.get(it.recipe_id);
      out.push({ item: it, row, recipe: rec });
    });
    return out;
  }, [plan?.items, rows, recipeMap]);

  const derivedTotals = useMemo(() => {
    // Sum scaled macros using multiplier (string-to-number)
    const totals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    selectedItems.forEach(({ recipe, item, row }) => {
      const m = Math.max(0, Number(row.multiplier || item.default_multiplier || 1)) || 1;
      const per = recipe?.per_serving || {};
      totals.calories += Number(per.calories || 0) * m;
      totals.protein_g += Number(per.protein_g || 0) * m;
      totals.carbs_g += Number(per.carbs_g || 0) * m;
      totals.fat_g += Number(per.fat_g || 0) * m;
    });
    return totals;
  }, [selectedItems]);

  const canAddToDay =
    !!planId &&
    !!dateYMD &&
    isYMD(dateYMD) &&
    !busy &&
    !!selectedItems.length &&
    !locked;

  async function ensureList(): Promise<string | null> {
    if (listId) return listId;
    const name = newListName.trim();
    if (!name) return null;
    const r = await fetch("/api/shopping/lists", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "Failed to create list");
    await mutateLists();
    return j?.id || null;
  }

  async function addToDayDefault() {
    if (!canAddToDay) return;
    setBusy(true); setMsg(null);
    try {
      const selection = selectedItems.map(({ item, row }) => ({
        recipe_id: item.recipe_id,
        multiplier: Math.max(0.25, Number(row.multiplier || item.default_multiplier || 1)) || 1,
      }));
      const res = await fetch("/api/mealplan/library/add-to-day", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId, date: dateYMD, selection }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Failed to add meals");
      setMsg("Meals added to your planner ✅");
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function addToDayTailorToMacros() {
    if (!canAddToDay) return;
    setBusy(true); setMsg(null);
    try {
      // Call your existing /api/mealplan/add per recipe with autoScale: true
      for (const { item, row } of selectedItems) {
        const body = {
          date: dateYMD,
          recipeId: item.recipe_id,
          meal_type: (item.meal_type || "dinner") as any, // default fallback
          autoScale: true,
        };
        const res = await fetch("/api/mealplan/add", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(t || `Failed to add ${item.recipe_id}`);
        }
      }
      setMsg("Meals tailored to your macros and added ✅");
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function createShoppingListFromSelection() {
    if (!selectedItems.length) return;
    setBusy(true); setMsg(null);
    try {
      const lid = await ensureList(); // may be null (then use global list merge)
      const items = selectedItems.map(({ item }) => ({ recipe_id: item.recipe_id, people: Math.max(1, Number(household) || 1) }));
      // Use your existing /api/shopping/list endpoint with action=addRecipes
      const res = await fetch("/api/shopping/list", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addRecipes", items, list_id: lid || undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Shopping list generation failed");
      setMsg("Shopping list updated with selection ✅");
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head><title>{plan?.title ? `${plan.title} • Meal Plan` : "Meal Plan"}</title></Head>
      <main className="container py-3" style={{ paddingBottom: 90, color: "#fff" }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <Link href="/nutrition-home" className="btn btn-outline-secondary">← Back</Link>
          <h2 className="m-0">{plan?.title || "Meal Plan"}</h2>
          <div style={{ width: 80 }} />
        </div>

        {loadingPlan && (
          <div className="text-center mt-4">
            <span className="inline-spinner mb-2" />
            <div className="small text-dim">Loading…</div>
          </div>
        )}

        {plan && (
          <>
            <section className="futuristic-card p-3 mb-3">
              <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 8 }}>
                <div className="d-flex align-items-center" style={{ gap: 12 }}>
                  {plan.image ? (
                    <img src={plan.image} alt={plan.title} style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover", border: "1px solid rgba(255,255,255,0.12)" }} />
                  ) : (
                    <div className="text-dim" style={{ width: 64, height: 64, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      No image
                    </div>
                  )}
                  <div>
                    <div className="fw-semibold" style={{ fontSize: 18 }}>{plan.title}</div>
                    <div className="small text-dim">{plan.description || "—"}</div>
                  </div>
                </div>
                <span className="badge" style={{ background: ACCENT, color: "#0b0f14" }}>
                  {plan.tier === "premium" ? "Premium" : "Free"}
                </span>
              </div>
              {locked && (
                <div className="alert alert-warning mt-2 mb-0">
                  This plan is premium. Upgrade your subscription to use it.
                </div>
              )}
            </section>

            {/* Controls */}
            <section className="futuristic-card p-3 mb-3">
              <div className="row g-2 align-items-end">
                <div className="col-12 col-md-4">
                  <label className="form-label">Date to add meals</label>
                  <input className="form-control" type="date" value={dateYMD} onChange={(e) => setDateYMD(e.target.value)} />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label">Tailor to my macros</label>
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" id="tailor" checked={tailor} onChange={(e) => setTailor(e.target.checked)} />
                    <label className="form-check-label" htmlFor="tailor">Auto‑scale each meal to your daily residual macros</label>
                  </div>
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label">Household (for shopping list)</label>
                  <input className="form-control" type="number" min={1} value={household} onChange={(e) => setHousehold(Math.max(1, Number(e.target.value) || 1))} />
                </div>
              </div>
            </section>

            {/* Items */}
            <section className="futuristic-card p-3 mb-3">
              <div className="d-flex align-items-center justify-content-between">
                <h6 className="m-0">Meals ({plan.items?.length || 0})</h6>
                <div className="small text-dim">
                  Selected totals:{" "}
                  <strong>{Math.round(derivedTotals.calories)} kcal</strong>{" "}
                  · P{Math.round(derivedTotals.protein_g)} · C{Math.round(derivedTotals.carbs_g)} · F{Math.round(derivedTotals.fat_g)}
                </div>
              </div>

              {!plan.items?.length ? (
                <div className="text-dim mt-2">No items in this plan.</div>
              ) : (
                <div className="table-responsive mt-2">
                  <table className="bxkr-table">
                    <thead>
                      <tr>
                        <th style={{ width: 48 }}>
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={rows.every(r => r.selected)}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setRows(rows.map(r => ({ ...r, selected: on })));
                            }}
                            aria-label="Select all"
                          />
                        </th>
                        <th>Meal</th>
                        <th>Recipe</th>
                        <th>Macros (per serving)</th>
                        <th>Multiplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.items.map((it, i) => {
                        const row = rows[i] || { selected: true, multiplier: String(it.default_multiplier ?? 1) };
                        const rec = recipeMap.get(it.recipe_id);
                        return (
                          <tr key={`${it.recipe_id}-${i}`}>
                            <td>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={!!row.selected}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  setRows((prev) => {
                                    const next = [...prev];
                                    next[i] = { ...row, selected: on };
                                    return next;
                                  });
                                }}
                                aria-label={`Select ${rec?.title || it.recipe_id}`}
                              />
                            </td>
                            <td className="text-capitalize">{it.meal_type || "—"}</td>
                            <td>
                              {rec ? (
                                <Link href={`/recipes/${rec.id}`} className="text-decoration-none" style={{ color: "#fff" }}>
                                  {rec.title}
                                </Link>
                              ) : (
                                <span className="text-dim">{it.recipe_id}</span>
                              )}
                            </td>
                            <td className="small text-dim">
                              {rec ? (
                                <>
                                  {Math.round(rec.per_serving?.calories || 0)} kcal ·{" "}
                                  P{Math.round(rec.per_serving?.protein_g || 0)} ·{" "}
                                  C{Math.round(rec.per_serving?.carbs_g || 0)} ·{" "}
                                  F{Math.round(rec.per_serving?.fat_g || 0)}
                                </>
                              ) : "—"}
                            </td>
                            <td style={{ width: 140 }}>
                              <input
                                className="form-control"
                                type="number"
                                min={0.25}
                                step={0.25}
                                value={row.multiplier}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setRows((prev) => {
                                    const next = [...prev];
                                    next[i] = { ...row, multiplier: v };
                                    return next;
                                  });
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Actions */}
            <section className="futuristic-card p-3">
              <div className="d-flex flex-wrap align-items-end" style={{ gap: 8 }}>
                <button
                  className="btn"
                  disabled={!canAddToDay}
                  onClick={tailor ? addToDayTailorToMacros : addToDayDefault}
                  style={{
                    borderRadius: 24,
                    color: "#0a0a0c",
                    background: canAddToDay ? `linear-gradient(90deg, ${ACCENT}, #ff7f32)` : "linear-gradient(90deg, #777, #555)",
                    border: "none",
                  }}
                  title={locked ? "Premium plan locked" : "Add selected meals to your chosen day"}
                >
                  {busy ? "Working…" : tailor ? "Add (Tailor to my macros)" : "Add to my day"}
                </button>

                <div className="vr mx-2" />

                <div className="d-flex align-items-end" style={{ gap: 8 }}>
                  <div>
                    <label className="form-label">Attach to existing list</label>
                    <select className="form-select" value={listId} onChange={(e) => setListId(e.target.value)}>
                      <option value="">— None —</option>
                      {lists.map((L) => (
                        <option key={L.id} value={L.id}>{L.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ minWidth: 220 }}>
                    <label className="form-label">Or new list name</label>
                    <input className="form-control" value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="e.g., Week 6 plan shop" />
                  </div>
                  <button
                    className="btn btn-bxkr-outline"
                    onClick={createShoppingListFromSelection}
                    disabled={busy || !selectedItems.length}
                    style={{ borderRadius: 24 }}
                  >
                    {busy ? "Working…" : "Generate shopping list"}
                  </button>
                </div>
              </div>

              {msg && (
                <div className={`alert ${msg.includes("✅") ? "alert-success" : "alert-info"} mt-3 mb-0`}>
                  {msg}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </>
  );
}
