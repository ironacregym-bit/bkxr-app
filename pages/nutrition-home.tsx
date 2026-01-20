
// pages/nutrition-home.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useMemo, useState } from "react";
import BottomNav from "../components/BottomNav";

type PlanItem = {
  id: string;
  title: string;
  meal_type: "breakfast"|"lunch"|"dinner"|"snack";
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

type ShoppingItem = {
  id: string;
  name: string;
  qty?: number|null;
  unit?: string|null;
  done?: boolean;
  added_at?: string;
};

const fetcher = (u: string) => fetch(u).then(r => r.json());

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function MacroBar({ label, val, target, unit = "" }: { label: string; val: number; target?: number|null; unit?: string }) {
  const safeTarget = target && target > 0 ? target : null;
  const pct = safeTarget ? Math.min(100, Math.round((val / safeTarget) * 100)) : 0;
  return (
    <div className="mb-2">
      <div className="d-flex justify-content-between">
        <span className="text-dim">{label}</span>
        <span>{Math.round(val)}{unit}{safeTarget ? ` / ${Math.round(safeTarget)}${unit}` : ""}</span>
      </div>
      {safeTarget ? (
        <div className="capacity">
          <div className="bar"><span style={{ width: `${pct}%` }} /></div>
        </div>
      ) : null}
    </div>
  );
}

export default function NutritionHome() {
  const { status, data: session } = useSession();
  const authed = status === "authenticated";
  const email = session?.user?.email ?? "";
  const [date, setDate] = useState<string>(todayYMD());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Profile for targets (mirrors your Profile page pattern)
  const { data: profData } = useSWR(authed && email ? `/api/profile?email=${encodeURIComponent(email)}` : null, fetcher);

  // Today’s plan
  const { data: planData, mutate: planMutate } = useSWR<PlanGet>(
    authed ? `/api/mealplan/get?date=${date}` : null,
    fetcher
  );
  const items = planData?.items || [];
  const totals = planData?.totals || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const targets = planData?.targets || null;

  // Shopping list (top 10 preview)
  const { data: listData, mutate: listMutate } = useSWR<{ items: ShoppingItem[] }>(
    authed ? `/api/shopping/list` : null,
    fetcher
  );
  const shopping = useMemo(() => (listData?.items || []).slice(0, 10), [listData]);

  async function updateMultiplier(item: PlanItem, newMul: number) {
    if (newMul <= 0) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/mealplan/update", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ date, itemId: item.id, multiplier: Number(newMul.toFixed(2)) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to update portion");
      planMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to update portion");
    } finally { setBusy(false); }
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
    } finally { setBusy(false); }
  }

  // Shopping helpers
  const [newItem, setNewItem] = useState<string>("");
  const [newQty, setNewQty] = useState<string>("");
  const [newUnit, setNewUnit] = useState<string>("");

  async function addShoppingItem() {
    if (!newItem.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/shopping/list", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ name: newItem.trim(), qty: newQty ? Number(newQty) : null, unit: newUnit || null }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to add item");
      setNewItem(""); setNewQty(""); setNewUnit("");
      listMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to add item");
    } finally { setBusy(false); }
  }

  async function toggleShoppingDone(id: string, done: boolean) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/shopping/list", {
        method: "PATCH",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ id, done: !done }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to update item");
      listMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to update item");
    } finally { setBusy(false); }
  }

  async function deleteShopping(id: string) {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/shopping/list", {
        method: "DELETE",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to delete item");
      listMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to delete item");
    } finally { setBusy(false); }
  }

  async function generateShoppingFromPlan() {
    if (!confirm("Generate a shopping list from today’s plan? This adds items (it won’t remove existing).")) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/shopping/generate", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ date }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to generate list");
      setMsg(`Shopping list updated • ${j?.added ?? 0} items added`);
      listMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to generate list");
    } finally { setBusy(false); }
  }

  return (
    <>
      <Head><title>BXKR • Nutrition</title></Head>
      <main className="container" style={{ paddingBottom: 90, minHeight: "80vh" }}>
        {/* Toolbar */}
        <section className="futuristic-card p-3 mb-3">
          <div className="d-flex flex-wrap align-items-center justify-content-between" style={{ gap: 8 }}>
            <h4 className="m-0">Nutrition</h4>
            <div className="d-flex gap-2">
              <input className="form-control" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Link href="/nutrition" className="btn-bxkr-outline">Log Nutrition</Link>
              <Link href="/recipes" className="btn-bxkr-outline">Recipes</Link>
              <button className="btn-bxkr-outline" onClick={generateShoppingFromPlan} disabled={busy}>Build Shopping List</button>
            </div>
          </div>
          {msg && <div className="alert alert-info mt-2">{msg}</div>}
        </section>

        {/* Overview + Plan */}
        <section className="futuristic-card p-3 mb-3">
          <div className="row g-3">
            <div className="col-12 col-md-6">
              <h6 className="mb-2">Today</h6>
              <MacroBar label="Calories" val={totals.calories} target={targets?.calories} />
              <MacroBar label="Protein" val={totals.protein_g} target={targets?.protein_g} unit="g" />
              <MacroBar label="Carbs" val={totals.carbs_g} target={targets?.carbs_g} unit="g" />
              <MacroBar label="Fat" val={totals.fat_g} target={targets?.fat_g} unit="g" />
              <div className="text-dim" style={{ fontSize: 12 }}>
                Targets are derived from your profile (caloric target and 30/40/30 P/C/F split unless configured).
              </div>
            </div>

            <div className="col-12 col-md-6">
              <h6 className="mb-2">Today’s Plan</h6>
              {!items.length ? (
                <div className="text-dim">No items yet. Add from <Link href="/recipes">Recipes</Link> or <Link href="/nutrition">Log Nutrition</Link>.</div>
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
                      {items.map((it) => (
                        <tr key={it.id}>
                          <td className="text-capitalize">{it.meal_type}</td>
                          <td>{it.title}</td>
                          <td className="d-flex gap-1 align-items-center">
                            <button className="btn-bxkr-outline" onClick={() => updateMultiplier(it, it.multiplier - 0.25)}>-</button>
                            <span style={{ minWidth: 48, textAlign: "center" }}>{it.multiplier.toFixed(2)}x</span>
                            <button className="btn-bxkr-outline" onClick={() => updateMultiplier(it, it.multiplier + 0.25)}>+</button>
                          </td>
                          <td>{Math.round(it.scaled?.calories || 0)}</td>
                          <td>{Math.round(it.scaled?.protein_g || 0)}</td>
                          <td>{Math.round(it.scaled?.carbs_g || 0)}</td>
                          <td>{Math.round(it.scaled?.fat_g || 0)}</td>
                          <td><button className="btn-bxkr-outline" onClick={() => removeItem(it)}>Remove</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Shopping list */}
        <section className="futuristic-card p-3">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h6 className="m-0">Shopping List</h6>
            <div className="d-flex gap-2">
              <input className="form-control" placeholder="Item…" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
              <input className="form-control" placeholder="Qty" value={newQty} onChange={(e) => setNewQty(e.target.value)} style={{ maxWidth: 90 }} />
              <input className="form-control" placeholder="Unit" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} style={{ maxWidth: 100 }} />
              <button className="btn-bxkr" onClick={addShoppingItem} disabled={busy || !newItem.trim()}>Add</button>
            </div>
          </div>

          {!shopping.length ? (
            <div className="text-dim">No items yet. Use “Build Shopping List” or add items above.</div>
          ) : (
            <div className="table-responsive">
              <table className="bxkr-table">
                <thead>
                  <tr>
                    <th>Done</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {shopping.map((si) => (
                    <tr key={si.id}>
                      <td>
                        <input
                          type="checkbox"
                          className="form-check-input habit-check"
                          checked={!!si.done}
                          onChange={() => toggleShoppingDone(si.id, !!si.done)}
                        />
                      </td>
                      <td>{si.name}</td>
                      <td>{si.qty ?? "-"}</td>
                      <td>{si.unit ?? "-"}</td>
                      <td>
                        <button className="btn-bxkr-outline" onClick={() => deleteShopping(si.id)}>Delete</button>
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
