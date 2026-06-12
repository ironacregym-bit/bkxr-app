// pages/nutrition-home.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import BottomNav from "../components/BottomNav";

type Totals = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type ShoppingListMeta = {
  id: string;
  name: string;
  people: number;
  created_at: string;
  updated_at: string;
};

type RecipeSummary = {
  id: string;
  title: string;
  meal_type?: string;
  image?: string | null;
  per_serving?: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
  };
};

type PlanSummary = {
  id: string;
  title: string;
  tier: "free" | "premium";
  description?: string | null;
  image?: string | null;
  locked?: boolean;
};

type MyPlanWeek = {
  ymd: string;
  day: string;
  items: Array<any>;
};

type MyPlanResp = {
  assignment: any | null;
  plan: any | null;
  week: MyPlanWeek[];
};

type ProfileTargets = {
  caloric_target?: number | null;
  calorie_target?: number | null;
  protein_target?: number | null;
  carb_target?: number | null;
  fat_target?: number | null;
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

function startOfAlignedWeek(d: Date) {
  const day = d.getDay();
  const diffToMon = (day + 6) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - diffToMon);
  s.setHours(0, 0, 0, 0);
  return s;
}

function formatYMD(d: Date) {
  return d.toLocaleDateString("en-CA");
}

function fmtDate(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function clampPct(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function LoadingCard({ title }: { title: string }) {
  return (
    <section className="ia-tile ia-tile-pad mb-3">
      <div className="d-flex align-items-center justify-content-between">
        <div className="ia-card-title-compact">{title}</div>
        <i className="fas fa-spinner fa-spin text-dim" />
      </div>
    </section>
  );
}

export default function NutritionHomePage() {
  const { status, data: session } = useSession();

  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [showPlansModal, setShowPlansModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanSummary | null>(null);
  const [assignBusy, setAssignBusy] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  const [listName, setListName] = useState("");
  const [household, setHousehold] = useState<number>(1);
  const [assignForm, setAssignForm] = useState<{
    start_date: string;
    weeks: number;
    overwrite: boolean;
  }>({
    start_date: "",
    weeks: 4,
    overwrite: true,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === "loading") return;

    if (status !== "authenticated" && typeof window !== "undefined") {
      window.location.replace(`/register?callbackUrl=${encodeURIComponent("/nutrition-home")}`);
    }
  }, [mounted, status]);

  const authed = status === "authenticated";
  const email = String(session?.user?.email || "").trim().toLowerCase();

  const { data: entriesResp } = useSWR<{ entries: any[] }>(
    authed && email ? `/api/nutrition/logs` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30_000,
    }
  );

  const { data: profileResp } = useSWR<ProfileTargets>(
    authed && email ? `/api/profile?email=${encodeURIComponent(email)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60_000,
    }
  );

  const totals: Totals = useMemo(() => {
    const entries = Array.isArray(entriesResp?.entries) ? entriesResp.entries : [];
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

  const mealsLogged = useMemo(() => {
    return Array.isArray(entriesResp?.entries) ? entriesResp!.entries.length : 0;
  }, [entriesResp]);

  const targets = useMemo(() => {
    const calories =
      Number(profileResp?.caloric_target ?? profileResp?.calorie_target ?? 0) || 0;
    const protein = Number(profileResp?.protein_target ?? 0) || 0;
    const carbs = Number(profileResp?.carb_target ?? 0) || 0;
    const fats = Number(profileResp?.fat_target ?? 0) || 0;

    return {
      calories,
      protein,
      carbs,
      fats,
    };
  }, [profileResp]);

  const remaining = useMemo(() => {
    return {
      calories: Math.max(0, targets.calories - totals.calories),
      protein: Math.max(0, targets.protein - totals.protein_g),
      carbs: Math.max(0, targets.carbs - totals.carbs_g),
      fats: Math.max(0, targets.fats - totals.fat_g),
    };
  }, [targets, totals]);

  const progress = useMemo(() => {
    return {
      calories: targets.calories > 0 ? clampPct((totals.calories / targets.calories) * 100) : 0,
      protein: targets.protein > 0 ? clampPct((totals.protein_g / targets.protein) * 100) : 0,
      carbs: targets.carbs > 0 ? clampPct((totals.carbs_g / targets.carbs) * 100) : 0,
      fats: targets.fats > 0 ? clampPct((totals.fat_g / targets.fats) * 100) : 0,
    };
  }, [targets, totals]);

  const { data: listsResp, mutate: mutateLists } = useSWR<{ lists: ShoppingListMeta[] }>(
    authed ? `/api/shopping/lists` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30_000,
    }
  );

  const lists = useMemo(() => listsResp?.lists || [], [listsResp]);

  const { data: favResp } = useSWR<{ favourites: string[]; recipes?: RecipeSummary[] }>(
    authed ? `/api/recipes/favourites?limit=8` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30_000,
    }
  );

  const favRecipes = useMemo(() => favResp?.recipes || [], [favResp]);

  const { data: myPlan, mutate: mutateMyPlan } = useSWR<MyPlanResp>(
    authed ? `/api/mealplan/my` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 20_000,
    }
  );

  const plansKey = showPlansModal ? `/api/mealplan/library/list` : null;
  const { data: plansResp } = useSWR<{ plans: PlanSummary[]; isPremium: boolean }>(
    plansKey,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const plans = useMemo(() => plansResp?.plans || [], [plansResp]);

  useEffect(() => {
    if (!showPlansModal) return;
    if (assignForm.start_date) return;

    const nextMon = startOfAlignedWeek(new Date());
    const nm = new Date(nextMon);
    nm.setDate(nextMon.getDate() + 7);

    setAssignForm((f) => ({
      ...f,
      start_date: formatYMD(nm),
    }));
  }, [showPlansModal, assignForm.start_date]);

  const weekStart = useMemo(() => startOfAlignedWeek(new Date()), []);
  const weekEnd = useMemo(() => {
    const e = new Date(weekStart);
    e.setDate(weekStart.getDate() + 6);
    return e;
  }, [weekStart]);

  const suggestionText = useMemo(() => {
    if (mealsLogged === 0) return "No meals logged yet — start with your first meal.";
    if (targets.protein > 0 && remaining.protein > 30) return `Protein is the priority — ${Math.round(remaining.protein)}g left today.`;
    if (targets.calories > 0 && remaining.calories > 0) return `${Math.round(remaining.calories)} kcal remaining today.`;
    return "You’re on track — keep logging meals to stay accurate.";
  }, [mealsLogged, targets, remaining]);

  async function createList() {
    const name = listName.trim() || "My List";
    setBusy(true);
    setMsg(null);

    try {
      const r = await fetch("/api/shopping/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to create list");

      setListName("");
      await mutateLists();
      setMsg("List created");
    } catch (e: any) {
      setMsg(e?.message || "Failed to create list");
    } finally {
      setBusy(false);
    }
  }

  async function deleteList(id: string) {
    if (!confirm("Delete this list and its items/meals?")) return;

    setBusy(true);
    setMsg(null);

    try {
      const r = await fetch("/api/shopping/lists", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to delete list");

      await mutateLists();
      setMsg("List deleted");
    } catch (e: any) {
      setMsg(e?.message || "Failed to delete list");
    } finally {
      setBusy(false);
    }
  }

  async function assignSelectedPlan() {
    if (!selectedPlan) return;

    setAssignBusy(true);
    setAssignMsg(null);

    try {
      const res = await fetch("/api/mealplan/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: selectedPlan.id,
          start_date: assignForm.start_date,
          weeks: assignForm.weeks,
          overwrite: assignForm.overwrite,
        }),
      });

      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || `Failed (${res.status})`);

      setAssignMsg("Plan assigned and meals added to your planner ✅");
      await mutateMyPlan();
    } catch (e: any) {
      setAssignMsg(e?.message || "Failed to assign plan");
    } finally {
      setAssignBusy(false);
    }
  }

  async function shoppingFromPlan(listId?: string) {
    setBusy(true);
    setMsg(null);

    try {
      const r = await fetch("/api/mealplan/shopping-from-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: formatYMD(weekStart),
          end_date: formatYMD(weekEnd),
          people: household,
          list_id: listId || undefined,
          plan_id: myPlan?.assignment?.plan_id || undefined,
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to generate shopping list");

      setMsg("Shopping list updated with plan recipes");
    } catch (e: any) {
      setMsg(e?.message || "Shopping list generation failed");
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || status === "loading") {
    return (
      <>
        <Head>
          <title>Nutrition • Iron Acre Gym</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </Head>
        <main className="container py-3 ia-nutrition-page">
          <LoadingCard title="Loading Nutrition" />
        </main>
        <BottomNav />
      </>
    );
  }

  if (!authed) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Nutrition • Iron Acre Gym</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-2 ia-nutrition-page">
        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-kicker">
            <i className="fas fa-utensils" />
            fuel
          </div>

          <div className="d-flex justify-content-between align-items-start gap-2 mt-1 flex-wrap">
            <div className="ia-nutrition-header-copy">
              <div className="ia-page-title">Nutrition</div>
              <div className="ia-page-subtitle">
                Track today, manage your lists and stay on top of your meal plan.
              </div>
            </div>

            <div className="d-flex gap-2">
              <Link href="/nutrition">
                <i className="fas fa-plus" />
              </Link>

              <Link href="/recipes">
                <i className="fas fa-book-open" />
              </Link>
            </div>
          </div>

          {msg ? <div className="ia-inline-note-success mt-3">{msg}</div> : null}
        </section>

        <section className="ia-tile ia-tile-pad mb-3 ia-nutrition-hero">
          <div className="row g-3 align-items-stretch">
            <div className="col-12 col-lg-5">
              <div className="ia-nutrition-hero-main">
                <div className="ia-kicker">today</div>
                <div className="ia-nutrition-hero-value">
                  {targets.calories > 0 ? Math.round(remaining.calories) : Math.round(totals.calories)}
                </div>
                <div className="ia-nutrition-hero-label">
                  {targets.calories > 0 ? "kcal remaining" : "kcal logged"}
                </div>

                <div className="ia-progress-track mt-3">
                  <div className="ia-progress-fill" style={{ width: `${progress.calories}%` }} />
                </div>

                <div className="d-flex justify-content-between align-items-center small mt-2">
                  <span className="text-dim">
                    {Math.round(totals.calories)} consumed
                  </span>
                  <span className="fw-semibold">
                    {targets.calories > 0 ? `${Math.round(totals.calories)} / ${Math.round(targets.calories)}` : "No target set"}
                  </span>
                </div>

                <div className="ia-inline-note-info mt-3">{suggestionText}</div>

                <div className="d-flex gap-2 mt-3 flex-wrap">
                  <Link href="/nutrition">
                    Log nutrition
                  </Link>

                  <Link href="/recipes">
                    Browse recipes
                  </Link>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-7">
              <div className="row g-2 h-100">
                <div className="col-6">
                  <div className="ia-nutrition-metric-card h-100">
                    <div className="d-flex justify-content-between align-items-center gap-2">
                      <div className="ia-list-row-title">Protein</div>
                      <div className="text-dim small">
                        {Math.round(totals.protein_g)} / {Math.round(targets.protein || 0)}g
                      </div>
                    </div>
                    <div className="ia-progress-track mt-2">
                      <div className="ia-progress-fill" style={{ width: `${progress.protein}%` }} />
                    </div>
                    <div className="text-dim small mt-2">
                      {targets.protein > 0 ? `${Math.round(remaining.protein)}g left` : "No target set"}
                    </div>
                  </div>
                </div>

                <div className="col-6">
                  <div className="ia-nutrition-metric-card h-100">
                    <div className="d-flex justify-content-between align-items-center gap-2">
                      <div className="ia-list-row-title">Carbs</div>
                      <div className="text-dim small">
                        {Math.round(totals.carbs_g)} / {Math.round(targets.carbs || 0)}g
                      </div>
                    </div>
                    <div className="ia-progress-track mt-2">
                      <div className="ia-progress-fill" style={{ width: `${progress.carbs}%` }} />
                    </div>
                    <div className="text-dim small mt-2">
                      {targets.carbs > 0 ? `${Math.round(remaining.carbs)}g left` : "No target set"}
                    </div>
                  </div>
                </div>

                <div className="col-6">
                  <div className="ia-nutrition-metric-card h-100">
                    <div className="d-flex justify-content-between align-items-center gap-2">
                      <div className="ia-list-row-title">Fats</div>
                      <div className="text-dim small">
                        {Math.round(totals.fat_g)} / {Math.round(targets.fats || 0)}g
                      </div>
                    </div>
                    <div className="ia-progress-track mt-2">
                      <div className="ia-progress-fill" style={{ width: `${progress.fats}%` }} />
                    </div>
                    <div className="text-dim small mt-2">
                      {targets.fats > 0 ? `${Math.round(remaining.fats)}g left` : "No target set"}
                    </div>
                  </div>
                </div>

                <div className="col-6">
                  <div className="ia-nutrition-metric-card h-100">
                    <div className="d-flex justify-content-between align-items-center gap-2">
                      <div className="ia-list-row-title">Meals logged</div>
                      <div className="text-dim small">today</div>
                    </div>
                    <div className="ia-nutrition-meals-count">{mealsLogged}</div>
                    <div className="text-dim small mt-1">
                      {mealsLogged === 0 ? "Start with your first meal" : "Keep building your day"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="row g-2 mb-3">
          <div className="col-12 col-md-6">
            <section className="ia-tile ia-tile-pad h-100">
              <div className="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <div className="ia-card-title-compact">Shopping lists</div>
                  <div className="text-dim small mt-1">
                    Create and manage your ingredient lists.
                  </div>
                </div>

                <Link href="/recipes">
                  Browse recipes
                </Link>
              </div>

              <div className="d-flex gap-2 mt-3 flex-wrap ia-list-create-row">
                <input
                  className="form-control ia-form-input ia-nutrition-list-input"
                  placeholder="List name"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                />
                <button
                  className="ia-btn ia-btn-primary"
                  onClick={createList}
                  disabled={busy}
                  type="button"
                >
                  Create
                </button>
              </div>

              {!lists.length ? (
                <div className="ia-empty-state mt-3">
                  <div className="ia-empty-state-title">No shopping lists yet</div>
                  <div className="text-dim small mt-1">
                    Create your first list or build one from recipes and meal plans.
                  </div>
                </div>
              ) : (
                <div className="d-grid gap-2 mt-3">
                  {lists.map((list) => (
                    <div key={list.id} className="ia-list-row">
                      <div className="ia-list-row-main">
                        <div className="ia-list-row-title">{list.name}</div>
                        <div className="text-dim small">People: {list.people || 1}</div>
                      </div>

                      <div className="d-flex gap-2">
                        <Link href="/shopping/${list.id}">
                          Open
                        </Link>
                        <button
                          type="button"
                          className="ia-btn ia-btn-outline"
                          onClick={() => deleteList(list.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="col-12 col-md-6">
            <section className="ia-tile ia-tile-pad h-100">
              <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                <div>
                  <div className="ia-card-title-compact">Meal plans</div>
                  <div className="text-dim small mt-1">
                    Assign a plan and turn this week into a shopping list.
                  </div>
                </div>

                <button
                  type="button"
                  className="ia-btn ia-btn-muted"
                  onClick={() => setShowPlansModal(true)}
                >
                  Browse plans
                </button>
              </div>

              {!myPlan?.assignment ? (
                <div className="ia-empty-state mt-3">
                  <div className="ia-empty-state-title">No active meal plan</div>
                  <div className="text-dim small mt-1">
                    Browse plans to add meals straight into your planner.
                  </div>
                </div>
              ) : (
                <>
                  <div className="ia-mealplan-header mt-3">
                    <div>
                      <div className="ia-list-row-title">
                        {myPlan.plan?.title || "Meal Plan"}
                        {myPlan.plan?.tier === "premium" ? (
                          <span className="ia-badge ia-badge-neon ms-2">Premium</span>
                        ) : null}
                      </div>
                      <div className="text-dim small mt-1">
                        {fmtDate(myPlan.assignment.start_date)} — {fmtDate(myPlan.assignment.end_date)}
                      </div>
                    </div>

                    <div className="ia-mealplan-actions">
                      <label className="ia-inline-label">Household</label>
                      <input
                        className="form-control ia-form-input ia-household-input"
                        type="number"
                        min={1}
                        value={household}
                        onChange={(e) => setHousehold(Math.max(1, Number(e.target.value) || 1))}
                      />
                      <button
                        type="button"
                        className="ia-btn ia-btn-primary"
                        onClick={() => shoppingFromPlan()}
                      >
                        Add week to shopping list
                      </button>
                    </div>
                  </div>

                  <div className="row g-2 mt-2">
                    {myPlan.week.map((d) => (
                      <div key={d.ymd} className="col-12 col-md-6">
                        <div className="ia-meal-day-card">
                          <div className="ia-list-row-title">
                            {d.day} <span className="text-dim small">({d.ymd})</span>
                          </div>

                          {!d.items.length ? (
                            <div className="text-dim small mt-2">—</div>
                          ) : (
                            <div className="d-grid gap-2 mt-2">
                              {d.items.slice(0, 2).map((it) => (
                                <div key={it.id} className="ia-meal-item">
                                  {it.image ? (
                                    <img
                                      src={it.image}
                                      alt={it.title || "Meal"}
                                      className="ia-meal-item-image"
                                    />
                                  ) : (
                                    <div className="ia-meal-item-image ia-meal-item-image-empty">
                                      No image
                                    </div>
                                  )}

                                  <div className="ia-meal-item-copy">
                                    <div className="ia-meal-item-title">{it.title || "Meal"}</div>
                                    <div className="text-dim small">
                                      {it.meal_type} • {Math.round(it.scaled?.calories || 0)} kcal • P
                                      {Math.round(it.scaled?.protein_g || 0)} • C
                                      {Math.round(it.scaled?.carbs_g || 0)} • F
                                      {Math.round(it.scaled?.fat_g || 0)}
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {d.items.length > 2 ? (
                                <div className="text-dim small">+{d.items.length - 2} more meals</div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
            <div>
              <div className="ia-card-title-compact">Favourite recipes</div>
              <div className="text-dim small mt-1">
                Quick access to the meals you’ve saved.
              </div>
            </div>

            <Link href="/recipes">
              Browse recipes
            </Link>
          </div>

          {!favRecipes.length ? (
            <div className="ia-empty-state mt-3">
              <div className="ia-empty-state-title">No favourites yet</div>
              <div className="text-dim small mt-1">
                Browse recipes and tap the heart to save meals for later.
              </div>
            </div>
          ) : (
            <div className="row g-2 mt-2">
              {favRecipes.map((r) => (
                <div
                  key={r.id}
                  className={
                    favRecipes.length === 1 ? "col-12 col-md-6" : "col-6 col-sm-4 col-md-3"
                  }
                >
                  <Link href="/recipes/${r.id}">
                    <div className="ia-recipe-card">
                      {r.image ? (
                        <img src={r.image} alt={r.title} className="ia-recipe-card-image" />
                      ) : (
                        <div className="ia-recipe-card-image ia-recipe-card-image-empty">
                          No image
                        </div>
                      )}

                      <div className="mt-2">
                        <div className="ia-recipe-card-title">{r.title}</div>
                        <div className="text-dim small mt-1">
                          {Math.round(r.per_serving?.calories || 0)} kcal • P
                          {Math.round(r.per_serving?.protein_g || 0)} • C
                          {Math.round(r.per_serving?.carbs_g || 0)} • F
                          {Math.round(r.per_serving?.fat_g || 0)}
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {showPlansModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="ia-modal-backdrop"
          onClick={() => {
            setShowPlansModal(false);
            setSelectedPlan(null);
            setAssignMsg(null);
          }}
        >
          <div className="ia-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
              <h5 className="mb-0">Browse meal plans</h5>
              <button
                type="button"
                className="ia-btn ia-btn-outline"
                onClick={() => {
                  setShowPlansModal(false);
                  setSelectedPlan(null);
                  setAssignMsg(null);
                }}
              >
                Close
              </button>
            </div>

            {!plans.length ? (
              <div className="text-dim small">No plans available yet.</div>
            ) : (
              <div className="row g-2">
                {plans.map((p) => (
                  <div key={p.id} className="col-12 col-md-6">
                    <div className="ia-plan-card">
                      <div className="ia-plan-card-image-wrap">
                        {p.image ? (
                          <img src={p.image} alt={p.title} className="ia-plan-card-image" />
                        ) : (
                          <div className="ia-plan-card-image ia-plan-card-image-empty">No image</div>
                        )}
                      </div>

                      <div className="ia-plan-card-copy">
                        <div className="ia-list-row-title">
                          {p.title}
                          {p.tier === "premium" ? (
                            <span className="ia-badge ia-badge-neon ms-2">Premium</span>
                          ) : null}
                        </div>

                        {p.description ? (
                          <div className="text-dim small mt-1">{p.description}</div>
                        ) : null}

                        <div className="d-flex gap-2 mt-2 flex-wrap">
                          <button
                            type="button"
                            className={p.locked ? "ia-btn ia-btn-muted" : "ia-btn ia-btn-primary"}
                            disabled={!!p.locked}
                            onClick={() => setSelectedPlan(p)}
                          >
                            {p.locked ? "Locked" : "Select"}
                          </button>

                          /recipes
                            View recipes
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedPlan ? (
              <div className="ia-plan-assign-box mt-3">
                <div className="ia-list-row-title mb-2">Assign: {selectedPlan.title}</div>

                {assignMsg ? (
                  <div className="ia-inline-note-success mb-2">{assignMsg}</div>
                ) : null}

                <div className="row g-2 align-items-end">
                  <div className="col-12 col-md-4">
                    <label className="form-label ia-label">Start date</label>
                    <input
                      className="form-control ia-form-input"
                      type="date"
                      value={assignForm.start_date}
                      onChange={(e) =>
                        setAssignForm((f) => ({
                          ...f,
                          start_date: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="col-6 col-md-3">
                    <label className="form-label ia-label">Weeks</label>
                    <input
                      className="form-control ia-form-input"
                      type="number"
                      min={1}
                      max={12}
                      value={assignForm.weeks}
                      onChange={(e) =>
                        setAssignForm((f) => ({
                          ...f,
                          weeks: Math.max(1, Math.min(12, Number(e.target.value) || 1)),
                        }))
                      }
                    />
                  </div>

                  <div className="col-6 col-md-5">
                    <label className="form-label ia-label">Options</label>
                    <div className="form-check">
                      <input
                        id="overwrite-plan"
                        className="form-check-input"
                        type="checkbox"
                        checked={assignForm.overwrite}
                        onChange={(e) =>
                          setAssignForm((f) => ({
                            ...f,
                            overwrite: e.target.checked,
                          }))
                        }
                      />
                      <label className="form-check-label" htmlFor="overwrite-plan">
                        Overwrite existing plan meals on those days
                      </label>
                    </div>
                  </div>
                </div>

                <div className="d-flex gap-2 mt-3 flex-wrap">
                  <button
                    type="button"
                    className="ia-btn ia-btn-primary"
                    onClick={assignSelectedPlan}
                    disabled={assignBusy}
                  >
                    {assignBusy ? "Assigning…" : "Assign to my planner"}
                  </button>

                  <button
                    type="button"
                    className="ia-btn ia-btn-outline"
                    onClick={() => {
                      setSelectedPlan(null);
                      setAssignMsg(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <BottomNav />
    </>
  );
}


