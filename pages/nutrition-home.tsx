
// pages/nutrition-home.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useMemo, useState } from "react";
import BottomNav from "../components/BottomNav";

type Totals = { calories: number; protein_g: number; carbs_g: number; fat_g: number };
type ShoppingItem = { id: string; name: string; qty?: number | null; unit?: string | null; done?: boolean };

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

export default function NutritionHome() {
  const { status, data: session } = useSession();
  const authed = status === "authenticated";
  const email = session?.user?.email ?? "";

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Today’s nutrition logs (source of truth for snapshot)
  const { data: entriesResp } = useSWR<{ entries: any[] }>(
    authed && email ? `/api/nutrition/logs` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30_000 }
  );

  // Snapshot totals from logs
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

  // Shopping list (current single list per user)
  const {
    data: listData,
    mutate: mutateShopping,
  } = useSWR<{ items: ShoppingItem[] }>(authed ? `/api/shopping/list` : null, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
  });
  const shopping = useMemo(() => (listData?.items || []).slice(0, 6), [listData]);

  // --- Add Food form state ---
  const [foodName, setFoodName] = useState("");
  const [foodQty, setFoodQty] = useState("");
  const [foodUnit, setFoodUnit] = useState("");

  // --- Add Recipe form state ---
  const [recipeId, setRecipeId] = useState("");
  const [people, setPeople] = useState("1");

  function numberOrNull(s: string): number | null {
    if (!s.trim()) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  async function addFoodToList() {
    const name = foodName.trim();
    if (!name) return;
    setBusy(true);
    setMsg(null);
    try {
      const payload = {
        action: "addFoods",
        foods: [
          {
            name,
            qty: numberOrNull(foodQty),
            unit: foodUnit.trim() || null,
          },
        ],
      };
      const r = await fetch("/api/shopping/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to add food");
      setFoodName("");
      setFoodQty("");
      setFoodUnit("");
      await mutateShopping();
      setMsg("Food added to your shopping list");
    } catch (e: any) {
      setMsg(e?.message || "Failed to add food");
    } finally {
      setBusy(false);
    }
  }

  async function addRecipeToList() {
    const rid = recipeId.trim();
    if (!rid) return;
    const ppl = Math.max(1, Number(people) || 1);
    setBusy(true);
    setMsg(null);
    try {
      const payload = {
        action: "addRecipe",
        recipe_id: rid,
        people: ppl,
      };
      const r = await fetch("/api/shopping/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to add recipe");
      setRecipeId("");
      setPeople("1");
      await mutateShopping();
      setMsg("Recipe ingredients added to your shopping list");
    } catch (e: any) {
      setMsg(e?.message || "Failed to add recipe");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Nutrition • BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main
        className="container py-3"
        style={{
          paddingBottom: 80,
          color: "#fff",
          borderRadius: 12,
          minHeight: "100vh",
        }}
      >
        {/* Header */}
        <div className="mb-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 8 }}>
            <div>
              <h1 className="h4 mb-0" style={{ fontWeight: 700 }}>
                Nutrition
              </h1>
              <small style={{ opacity: 0.75 }}>Fuel the work</small>
            </div>

            {/* Back button (top-right) */}
            <Link
              href="/"
              className="btn btn-bxkr-outline btn-sm"
              style={{ borderRadius: 24, display: "inline-flex", alignItems: "center", gap: 6 }}
              aria-label="Back to home"
            >
              <i className="fas fa-arrow-left" /> <span>Back</span>
            </Link>
          </div>

          {msg && <div className="alert alert-info mt-2 mb-0">{msg}</div>}
        </div>

        {/* Tiles: left = Today snapshot; right = Shopping add/preview */}
        <section className="row gx-3">
          {/* Today snapshot — one line + CTA, whole tile clickable */}
          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-0" style={{ height: "100%", overflow: "hidden" }}>
              <Link
                href="/nutrition"
                className="d-block p-3 text-decoration-none"
                style={{ color: "inherit" }}
                aria-label="Open Log Nutrition"
              >
                <h6 className="mb-2" style={{ fontWeight: 700 }}>
                  Today
                </h6>
                <div className="d-flex align-items-center" style={{ gap: 10, fontWeight: 600 }}>
                  <span>
                    Cal {Math.round(totals.calories)}
                  </span>
                  <span className="text-dim">•</span>
                  <span>P {Math.round(totals.protein_g)}g</span>
                  <span className="text-dim">•</span>
                  <span>C {Math.round(totals.carbs_g)}g</span>
                  <span className="text-dim">•</span>
                  <span>F {Math.round(totals.fat_g)}g</span>
                </div>
                <div className="text-dim mt-1" style={{ fontSize: 12 }}>
                  Snapshot of what you’ve logged today.
                </div>
              </Link>

              {/* CTA row placed outside the linked block */}
              <div className="px-3 pb-3">
                <Link
                  href="/nutrition"
                  className="btn btn-sm"
                  style={{
                    borderRadius: 24,
                    color: "#fff",
                    background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                    boxShadow: `0 0 14px ${ACCENT}66`,
                    border: "none",
                    paddingInline: 14,
                  }}
                >
                  Log Nutrition
                </Link>
              </div>
            </div>
          </div>

          {/* Shopping: add foods/recipes + preview current list */}
          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-3" style={{ height: "100%" }}>
              <div className="d-flex align-items-center justify-content-between mb-2" style={{ gap: 8 }}>
                <h6 className="m-0" style={{ fontWeight: 700 }}>
                  Shopping
                </h6>
              </div>

              {/* Add Food (single) */}
              <div className="d-flex flex-wrap align-items-end mb-2" style={{ gap: 8 }}>
                <input
                  className="form-control"
                  placeholder="Food (e.g., Chicken breast)"
                  value={foodName}
                  onChange={(e) => setFoodName(e.target.value)}
                  style={{ minWidth: 160, flex: 1 }}
                />
                <input
                  className="form-control"
                  placeholder="Qty"
                  value={foodQty}
                  onChange={(e) => setFoodQty(e.target.value)}
                  style={{ width: 90 }}
                />
                <input
                  className="form-control"
                  placeholder="Unit (e.g., g, tub)"
                  value={foodUnit}
                  onChange={(e) => setFoodUnit(e.target.value)}
                  style={{ width: 110 }}
                />
                <button
                  className="btn btn-sm"
                  onClick={addFoodToList}
                  disabled={busy || !foodName.trim()}
                  style={{
                    borderRadius: 24,
                    color: "#fff",
                    background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                    boxShadow: `0 0 14px ${ACCENT}66`,
                    border: "none",
                    paddingInline: 14,
                  }}
                >
                  Add Food
                </button>
              </div>

              {/* Add Recipe (scaled by people) */}
              <div className="d-flex flex-wrap align-items-end mb-3" style={{ gap: 8 }}>
                <input
                  className="form-control"
                  placeholder="Recipe ID"
                  value={recipeId}
                  onChange={(e) => setRecipeId(e.target.value)}
                  style={{ minWidth: 160, flex: 1 }}
                />
                <input
                  className="form-control"
                  type="number"
                  min={1}
                  placeholder="People"
                  value={people}
                  onChange={(e) => setPeople(e.target.value)}
                  style={{ width: 110 }}
                />
                <button
                  className="btn btn-bxkr-outline btn-sm"
                  onClick={addRecipeToList}
                  disabled={busy || !recipeId.trim()}
                  style={{ borderRadius: 24 }}
                >
                  Add Recipe
                </button>
                <Link href="/recipes" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
                  Browse Recipes
                </Link>
              </div>

              {/* Current list preview */}
              {!shopping.length ? (
                <div className="text-dim">No items yet. Add foods or recipe ingredients above.</div>
              ) : (
                <ul className="list-unstyled m-0">
                  {shopping.map((si) => (
                    <li
                      key={si.id}
                      className="d-flex align-items-center justify-content-between"
                      style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      <div className="d-flex align-items-center" style={{ gap: 10 }}>
                        <div>
                          <div className="fw-semibold">{si.name}</div>
                          <div className="text-dim" style={{ fontSize: 12 }}>
                            {(si.qty ?? "-")} {si.unit ?? ""}
                          </div>
                        </div>
                      </div>
                      <span
                        className="badge"
                        style={{
                          background: si.done ? "rgba(50,255,127,0.15)" : "rgba(255,255,255,0.06)",
                          color: si.done ? "#32ff7f" : "#cfd7df",
                          borderRadius: 16,
                          padding: "4px 10px",
                          fontSize: 12,
                        }}
                      >
                        {si.done ? "Done" : "Open"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}
