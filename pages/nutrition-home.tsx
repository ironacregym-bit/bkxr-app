"use client";

import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "../components/BottomNav";

type Totals = { calories: number; protein_g: number; carbs_g: number; fat_g: number };
type ShoppingListMeta = { id: string; name: string; people: number; created_at: string; updated_at: string };
type RecipeSummary = { id: string; title: string; meal_type?: string; image?: string|null; per_serving?: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number } };
type PlanSummary = { id: string; title: string; tier: "free"|"premium"; description?: string|null; image?: string|null; locked?: boolean };
type MyPlanWeek = { ymd: string; day: string; items: Array<any> };
type MyPlanResp = { assignment: any|null; plan: any|null; week: MyPlanWeek[]; };

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

function startOfAlignedWeek(d: Date) { const day = d.getDay(); const diffToMon = (day + 6) % 7; const s = new Date(d); s.setDate(d.getDate() - diffToMon); s.setHours(0,0,0,0); return s; }
function formatYMD(d: Date) { return d.toLocaleDateString("en-CA"); }
function fmtDate(d: string | Date) { const dt = typeof d === "string" ? new Date(d) : d; return dt.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" }); }

export default function NutritionHome() {
  const { status, data: session } = useSession();
  const authed = status === "authenticated";
  const email = session?.user?.email ?? "";

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Today snapshot from existing logs
  const { data: entriesResp } = useSWR<{ entries: any[] }>(
    authed && email ? `/api/nutrition/logs` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30_000 }
  );
  const totals: Totals = useMemo(() => {
    const entries = Array.isArray(entriesResp?.entries) ? entriesResp!.entries : [];
    return entries.reduce(
      (acc, it) => {
        acc.calories += Number(it.calories || 0);
        acc.protein_g += Number(it.protein || 0);
        acc.carbs_g += Number(it.carbs || 0);
        acc.fat_g += Number(it.fat || 0);
        return acc;
      },
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 } as Totals
    );
  }, [entriesResp]);

  // Shopping lists
  const { data: listsResp, mutate: mutateLists } = useSWR<{ lists: ShoppingListMeta[] }>(
    authed ? `/api/shopping/lists` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30_000 }
  );
  const lists = useMemo(() => listsResp?.lists || [], [listsResp]);

  // Favourite recipes (tile)
  const { data: favResp } = useSWR<{ favourites: string[]; recipes?: RecipeSummary[] }>(
    authed ? `/api/recipes/favourites?limit=8` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30_000 }
  );
  const favRecipes = useMemo(() => favResp?.recipes || [], [favResp]);

  // Meal plan: my current + this week
  const { data: myPlan, mutate: mutateMyPlan } = useSWR<MyPlanResp>(
    authed ? `/api/mealplan/my` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 20_000 }
  );

  // Meal plan library (loaded when modal open)
  const [showPlansModal, setShowPlansModal] = useState(false);
  const plansKey = showPlansModal ? `/api/mealplan/library/list` : null;
  const { data: plansResp } = useSWR<{ plans: PlanSummary[]; isPremium: boolean }>(plansKey, fetcher, { revalidateOnFocus: false });
  const plans = useMemo(() => plansResp?.plans || [], [plansResp]);

  // Create shopping list
  const [listName, setListName] = useState("");
  async function createList() {
    const name = listName.trim() || "My List";
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/shopping/lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to create list");
      setListName(""); await mutateLists(); setMsg("List created");
    } catch (e: any) { setMsg(e?.message || "Failed to create list"); } finally { setBusy(false); }
  }
  async function deleteList(id: string) {
    if (!confirm("Delete this list and its items/meals?")) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/shopping/lists", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to delete list");
      await mutateLists(); setMsg("List deleted");
    } catch (e: any) { setMsg(e?.message || "Failed to delete list"); } finally { setBusy(false); }
  }

  // Assign modal state
  const [selectedPlan, setSelectedPlan] = useState<PlanSummary | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState<{ start_date: string; weeks: number; overwrite: boolean }>({ start_date: "", weeks: 4, overwrite: true });

  useEffect(() => {
    if (showPlansModal && !assignForm.start_date) {
      const nextMon = startOfAlignedWeek(new Date()); const nm = new Date(nextMon); nm.setDate(nextMon.getDate() + 7);
      setAssignForm((f) => ({ ...f, start_date: formatYMD(nm) }));
    }
  }, [showPlansModal, assignForm.start_date]);

  async function assignSelectedPlan() {
    if (!selectedPlan) return;
    setAssignBusy(true); setAssignMsg(null);
    try {
      const res = await fetch("/api/mealplan/assign", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: selectedPlan.id, start_date: assignForm.start_date, weeks: assignForm.weeks, overwrite: assignForm.overwrite }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);
      setAssignMsg("Plan assigned and meals added to your planner ✅");
      await mutateMyPlan();
    } catch (e: any) { setAssignMsg(e?.message || "Failed to assign plan"); } finally { setAssignBusy(false); }
  }

  // Shopping list from plan (household size)
  const [household, setHousehold] = useState<number>(1);
  const weekStart = useMemo(() => startOfAlignedWeek(new Date()), []);
  const weekEnd = useMemo(() => { const e = new Date(weekStart); e.setDate(weekStart.getDate() + 6); return e; }, [weekStart]);
  async function shoppingFromPlan(listId?: string) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/mealplan/shopping-from-plan", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: formatYMD(weekStart), end_date: formatYMD(weekEnd), people: household, list_id: listId || undefined, plan_id: myPlan?.assignment?.plan_id || undefined }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to generate shopping list");
      setMsg("Shopping list updated with plan recipes");
    } catch (e: any) { setMsg(e?.message || "Shopping list generation failed"); } finally { setBusy(false); }
  }

  return (
    <>
      <Head><title>Nutrition • BXKR</title><meta name="viewport" content="width=device-width, initial-scale=1.0" /></Head>
      <main className="container py-3" style={{ paddingBottom: 80, color: "#fff", borderRadius: 12, minHeight: "100vh" }}>
        <div className="mb-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 8 }}>
            <div><h1 className="h4 mb-0" style={{ fontWeight: 700 }}>Nutrition</h1><small style={{ opacity: 0.75 }}>Fuel the work</small></div>
            <Link href="/" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24, display: "inline-flex", alignItems: "center", gap: 6 }} aria-label="Back to home">
              <i className="fas fa-arrow-left" /> <span>Back</span>
            </Link>
          </div>
          {msg && <div className="alert alert-info mt-2 mb-0">{msg}</div>}
        </div>

        <section className="row gx-3">
          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-0" style={{ height: "100%", overflow: "hidden" }}>
              <Link href="/nutrition" className="d-block p-3 text-decoration-none" style={{ color: "inherit" }} aria-label="Open Log Nutrition">
                <h6 className="mb-2" style={{ fontWeight: 700 }}>Today</h6>
                <div className="d-flex align-items-center" style={{ gap: 10, fontWeight: 600 }}>
                  <span>Cal {Math.round(totals.calories)}</span><span className="text-dim">•</span>
                  <span>P {Math.round(totals.protein_g)}g</span><span className="text-dim">•</span>
                  <span>C {Math.round(totals.carbs_g)}g</span><span className="text-dim">•</span>
                  <span>F {Math.round(totals.fat_g)}g</span>
                </div>
                <div className="text-dim mt-1" style={{ fontSize: 12 }}>Snapshot of what you’ve logged today.</div>
              </Link>
              <div className="px-3 pb-3">
                <Link href="/nutrition" className="btn btn-sm" style={{ borderRadius: 24, color: "#fff", background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`, boxShadow: `0 0 14px ${ACCENT}66`, border: "none", paddingInline: 14 }}>
                  Log Nutrition
                </Link>
              </div>
            </div>
          </div>

          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-3" style={{ height: "100%" }}>
              <div className="d-flex align-items-center justify-content-between mb-2" style={{ gap: 8 }}>
                <h6 className="m-0" style={{ fontWeight: 700 }}>Shopping Lists</h6>
                <Link href="/recipes" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>Browse Recipes</Link>
              </div>
              <div className="d-flex flex-wrap align-items-end mb-3" style={{ gap: 8 }}>
                <input className="form-control" placeholder="List name" value={listName} onChange={(e) => setListName(e.target.value)} style={{ minWidth: 180, flex: 1 }} />
                <button className="btn btn-sm" onClick={createList} disabled={busy} style={{ borderRadius: 24, color: "#fff", background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`, boxShadow: `0 0 14px ${ACCENT}66`, border: "none", paddingInline: 14 }}>Create</button>
              </div>
              {!lists.length ? (
                <div className="text-dim">No lists yet. Create one to get started.</div>
              ) : (
                <ul className="list-unstyled m-0">
                  {lists.map((L) => (
                    <li key={L.id} className="d-flex align-items-center justify-content-between" style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <div><div className="fw-semibold">{L.name}</div></div>
                      <div className="d-flex" style={{ gap: 8 }}>
                        <Link href={`/shopping/${L.id}`} className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>Open</Link>
                        <button className="btn btn-bxkr-outline btn-sm" onClick={() => deleteList(L.id)} style={{ borderRadius: 24 }}>Delete</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="row gx-3 mt-1">
          <div className="col-12 mb-3">
            <div className="futuristic-card p-3">
              <div className="d-flex align-items-center justify-content-between mb-2" style={{ gap: 8 }}>
                <h6 className="m-0" style={{ fontWeight: 700 }}>Meal Plans</h6>
                <div className="d-flex" style={{ gap: 8 }}>
                  <button className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }} onClick={() => setShowPlansModal(true)}>Browse Plans</button>
                </div>
              </div>

              {!myPlan?.assignment ? (
                <div className="text-dim">No active meal plan. Browse plans to get started.</div>
              ) : (
                <>
                  <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 8 }}>
                    <div>
                      <div className="fw-semibold" style={{ fontSize: 16 }}>
                        {myPlan.plan?.title || "Meal Plan"}{myPlan.plan?.tier === "premium" && <span style={{ marginLeft: 8 }} className="badge bg-warning text-dark">Premium</span>}
                      </div>
                      <div className="text-dim" style={{ fontSize: 12 }}>
                        {fmtDate(myPlan.assignment.start_date)} — {fmtDate(myPlan.assignment.end_date)}
                      </div>
                    </div>
                    <div className="d-flex align-items-center" style={{ gap: 8 }}>
                      <label className="form-label m-0" style={{ fontSize: 12 }}>Household</label>
                      <input className="form-control" type="number" min={1} value={household} onChange={(e) => setHousehold(Math.max(1, Number(e.target.value) || 1))} style={{ width: 80 }} />
                      <button className="btn btn-sm" onClick={() => shoppingFromPlan()} style={{ borderRadius: 24, color: "#0b0f14", background: ACCENT, border: "none" }} title="Add this week's plan recipes to a shopping list">Add Week to Shopping List</button>
                    </div>
                  </div>

                  <div className="row g-2 mt-2">
                    {myPlan.week.map((d) => (
                      <div key={d.ymd} className="col-12 col-md-6 col-lg-4">
                        <div className="p-2" style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}>
                          <div className="fw-semibold" style={{ marginBottom: 6 }}>{d.day} <span className="text-dim" style={{ fontSize: 12 }}>({d.ymd})</span></div>
                          {!d.items.length ? (
                            <div className="text-dim small">—</div>
                          ) : (
                            <ul className="list-unstyled m-0">
                              {d.items.map((it) => (
                                <li key={it.id} className="d-flex align-items-start" style={{ gap: 8, padding: "6px 0" }}>
                                  {it.image ? (
                                    <img src={it.image} alt={it.title || "Meal"} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)" }} />
                                  ) : (
                                    <div style={{ width: 40, height: 40, borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }} className="text-dim small">No</div>
                                  )}
                                  <div style={{ flex: 1 }}>
                                    <div className="fw-semibold" style={{ lineHeight: 1.2 }}>{it.title || "Meal"}</div>
                                    <div className="text-dim" style={{ fontSize: 12 }}>
                                      {it.meal_type} • {Math.round(it.scaled?.calories || 0)} kcal • P{Math.round(it.scaled?.protein_g || 0)} • C{Math.round(it.scaled?.carbs_g || 0)} • F{Math.round(it.scaled?.fat_g || 0)}
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="row gx-3 mt-1">
          <div className="col-12 mb-3">
            <div className="futuristic-card p-3">
              <div className="d-flex align-items-center justify-content-between mb-2" style={{ gap: 8 }}>
                <h6 className="m-0" style={{ fontWeight: 700 }}>Favourite Recipes</h6>
                <Link href="/recipes" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>Browse Recipes</Link>
              </div>
              {!favRecipes.length ? (
                <div className="text-dim">No favourites yet. Browse recipes and tap the heart to save.</div>
              ) : (
                <div className="row g-2">
                  {favRecipes.map((r) => (
                    <div key={r.id} className="col-6 col-sm-4 col-md-3">
                      <Link href={`/recipes/${r.id}`} className="futuristic-card p-2 text-decoration-none" style={{ display: "block", color: "inherit", borderRadius: 12 }}>
                        {r.image ? (
                          <img src={r.image} alt={r.title} style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 10 }} />
                        ) : (
                          <div className="text-dim" style={{ height: 110, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--bxkr-card-border)", borderRadius: 10 }}>No image</div>
                        )}
                        <div className="mt-2">
                          <div className="fw-semibold" style={{ lineHeight: 1.2 }}>{r.title}</div>
                          <div className="text-dim" style={{ fontSize: 12 }}>
                            {Math.round(r.per_serving?.calories || 0)} kcal • P{Math.round(r.per_serving?.protein_g || 0)} • C{Math.round(r.per_serving?.carbs_g || 0)} • F{Math.round(r.per_serving?.fat_g || 0)}
                          </div>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {showPlansModal && (
        <div role="dialog" aria-modal="true" className="fixed top-0 left-0 w-100 h-100"
             style={{ zIndex: 1050, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
             onClick={() => setShowPlansModal(false)}>
          <div className="futuristic-card p-3" style={{ width: "100%", maxWidth: 900 }} onClick={(e) => e.stopPropagation()}>
            <div className="d-flex align-items-center justify-content-between mb-2" style={{ gap: 8 }}>
              <h5 className="mb-0">Browse Meal Plans</h5>
              <button className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }} onClick={() => setShowPlansModal(false)}>Close</button>
            </div>

            {!plans.length ? (
              <div className="text-dim">No plans available yet.</div>
            ) : (
              <div className="row g-2">
                {plans.map((p) => (
                  <div key={p.id} className="col-12 col-md-6">
                    <div className="p-2" style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }}>
                      <div className="d-flex" style={{ gap: 10 }}>
                        <div style={{ width: 84, height: 84, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", overflow: "hidden", background: "rgba(255,255,255,0.04)" }}>
                          {p.image ? <img src={p.image} alt={p.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div className="text-dim small d-flex align-items-center justify-content-center" style={{ width: "100%", height: "100%" }}>No image</div>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="fw-semibold" style={{ lineHeight: 1.1 }}>
                            {p.title} {p.tier === "premium" && <span className="badge bg-warning text-dark" style={{ marginLeft: 6 }}>Premium</span>}
                          </div>
                          {p.description && <div className="text-dim small mt-1">{p.description}</div>}
                          <div className="d-flex mt-2" style={{ gap: 8 }}>
                            <button
                              className="btn btn-sm"
                              disabled={!!p.locked}
                              onClick={() => setSelectedPlan(p)}
                              style={{
                                borderRadius: 24,
                                color: p.locked ? "#aaa" : "#0a0a0c",
                                background: p.locked ? "linear-gradient(90deg, #777, #555)" : `linear-gradient(90deg, ${ACCENT}, #ff7f32)`,
                                border: "none",
                              }}
                              title={p.locked ? "Premium plan requires an active subscription" : "Select plan"}
                            >
                              {p.locked ? "Locked" : "Select"}
                            </button>
                            <Link href={`/recipes`} className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>View Recipes</Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedPlan && (
              <div className="mt-3 p-2" style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }}>
                <div className="fw-semibold" style={{ marginBottom: 6 }}>Assign: {selectedPlan.title}</div>
                {assignMsg && <div className={`alert ${assignMsg.includes("Failed") ? "alert-danger" : "alert-info"} py-2 mb-2`}>{assignMsg}</div>}
                <div className="row g-2 align-items-end">
                  <div className="col-12 col-md-4">
                    <label className="form-label">Start date</label>
                    <input className="form-control" type="date" value={assignForm.start_date} onChange={(e) => setAssignForm((f) => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div className="col-6 col-md-3">
                    <label className="form-label">Weeks</label>
                    <input className="form-control" type="number" min={1} max={12} value={assignForm.weeks} onChange={(e) => setAssignForm((f) => ({ ...f, weeks: Math.max(1, Math.min(12, Number(e.target.value) || 1)) }))} />
                  </div>
                  <div className="col-6 col-md-5">
                    <label className="form-label">Options</label>
                    <div className="form-check">
                      <input id="overwrite-plan" className="form-check-input" type="checkbox" checked={assignForm.overwrite} onChange={(e) => setAssignForm((f) => ({ ...f, overwrite: e.target.checked }))} />
                      <label className="form-check-label" htmlFor="overwrite-plan">Overwrite existing plan meals on those days</label>
                    </div>
                  </div>
                </div>
                <div className="d-flex mt-2" style={{ gap: 8 }}>
                  <button className="btn btn-sm" onClick={assignSelectedPlan} disabled={assignBusy} style={{ borderRadius: 24, color: "#0a0a0c", background: `linear-gradient(90deg, ${ACCENT}, #ff7f32)`, border: "none" }}>
                    {assignBusy ? "Assigning…" : "Assign to my planner"}
                  </button>
                  <button className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }} onClick={() => setSelectedPlan(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </>
  );
}
