
// pages/nutrition-home.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { useMemo, useState } from "react";
import BottomNav from "../components/BottomNav";

type Totals = { calories: number; protein_g: number; carbs_g: number; fat_g: number };
type ShoppingItem = { id: string; name: string; qty?: number|null; unit?: string|null; done?: boolean };

const fetcher = (u: string) => fetch(u).then(r => r.json());

function todayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function addDays(ymd: string, delta: number) {
  const d = new Date(`${ymd}T00:00:00`);
  d.setDate(d.getDate() + delta);
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

  // Logged totals for the day (NOT meal plan)
  const { data: totalsResp } = useSWR<{ totals: Totals }>(
    authed && email ? `/api/nutrition/totals?date=${date}` : null,
    fetcher
  );
  const totals: Totals = totalsResp?.totals ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

  // Optional targets (from your /api/mealplan/get since it already computes P/C/F targets from profile)
  // If you want targets strictly from /api/profile, swap this out later.
  const { data: planGet } = useSWR<{ targets: Totals | null }>(
    authed ? `/api/mealplan/get?date=${date}` : null,
    fetcher
  );
  const targets = planGet?.targets || null;

  // Shopping list preview
  const { data: listData, mutate: listMutate } = useSWR<{ items: ShoppingItem[] }>(
    authed ? `/api/shopping/list` : null,
    fetcher
  );
  const shopping = useMemo(() => (listData?.items || []).slice(0, 10), [listData]);

  // Shopping actions
  const [newItem, setNewItem] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("");

  async function addShoppingItem() {
    if (!newItem.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/shopping/list", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ name: newItem.trim(), qty: newQty ? Number(newQty) : null, unit: newUnit || null }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to add");
      setNewItem(""); setNewQty(""); setNewUnit("");
      listMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to add item");
    } finally { setBusy(false); }
  }
  async function toggleShoppingDone(id: string, done: boolean) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/shopping/list", {
        method: "PATCH",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ id, done: !done }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to update item");
      listMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to update item");
    } finally { setBusy(false); }
  }
  async function deleteShopping(id: string) {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/shopping/list", {
        method: "DELETE",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to delete item");
      listMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to delete item");
    } finally { setBusy(false); }
  }
  async function generateShoppingFromPlan() {
    if (!confirm("Generate a shopping list from today’s meal plan? This adds items (it won’t remove existing).")) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/shopping/generate", {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ date }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to generate list");
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
        {/* Actions + Date switcher */}
        <section className="futuristic-card mb-3">
          <div className="d-flex flex-wrap align-items-center justify-content-between" style={{ gap: 8 }}>
            <div className="d-flex align-items-center gap-2">
              <button
                className="btn-bxkr-outline"
                aria-label="Previous day"
                onClick={() => setDate(addDays(date, -1))}
              >
                <i className="fas fa-chevron-left" />
              </button>
              <input
                className="form-control"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ minWidth: 160 }}
              />
              <button
                className="btn-bxkr-outline"
                aria-label="Next day"
                onClick={() => setDate(addDays(date, +1))}
              >
                <i className="fas fa-chevron-right" />
              </button>
            </div>

            <div className="d-flex gap-2">
              {/* Orange gradient CTA buttons (reuse your .btn-bxkr) */}
              <Link className="btn-bxkr" href="/nutrition">Log Nutrition</Link>
              <Link className="btn-bxkr" href="/recipes">Recipes</Link>
              <button className="btn-bxkr" onClick={generateShoppingFromPlan} disabled={busy}>
                Build Shopping List
              </button>
            </div>
          </div>
          {msg && <div className="alert alert-info mt-2">{msg}</div>}
        </section>

        {/* Today macros (FROM LOGGED ENTRIES) */}
        <section className="futuristic-card mb-3">
          <h6 className="mb-2">Today</h6>
          <MacroBar label="Calories" val={totals.calories} target={targets?.calories} />
          <MacroBar label="Protein"  val={totals.protein_g} target={targets?.protein_g} unit="g" />
          <MacroBar label="Carbs"    val={totals.carbs_g}   target={targets?.carbs_g}   unit="g" />
          <MacroBar label="Fat"      val={totals.fat_g}     target={targets?.fat_g}     unit="g" />
          <div className="text-dim" style={{ fontSize: 12 }}>
            These totals are from what you’ve logged today. Targets come from your profile (P/C/F split), not the plan.
          </div>
        </section>

        {/* Shopping list (mobile-first) */}
        <section className="futuristic-card">
          <div className="d-flex flex-wrap align-items-center justify-content-between mb-2" style={{ gap: 8 }}>
            <h6 className="m-0">Shopping List</h6>
            <div className="d-flex gap-2" style={{ width: "100%", maxWidth: 620 }}>
              <input className="form-control" placeholder="Item…" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
              <input className="form-control" placeholder="Qty" value={newQty} onChange={(e) => setNewQty(e.target.value)} style={{ maxWidth: 90 }} />
              <input className="form-control" placeholder="Unit" value={newUnit} onChange={(e) => setNewUnit(e.target.value)} style={{ maxWidth: 100 }} />
              <button className="btn-bxkr" onClick={addShoppingItem} disabled={busy || !newItem.trim()}>Add</button>
            </div>
          </div>

          {!shopping.length ? (
            <div className="text-dim">No items yet. Build a list from your meal plan or add items above.</div>
          ) : (
            <ul className="list-unstyled m-0">
              {shopping.map((si) => (
                <li
                  key={si.id}
                  className="d-flex align-items-center justify-content-between"
                  style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <input
                      type="checkbox"
                      className="form-check-input habit-check"
                      checked={!!si.done}
                      onChange={() => toggleShoppingDone(si.id, !!si.done)}
                    />
                    <div>
                      <div>{si.name}</div>
                      <div className="text-dim" style={{ fontSize: 12 }}>
                        {(si.qty ?? "-")} {si.unit ?? ""}
                      </div>
                    </div>
                  </div>
                  <button className="btn-bxkr-outline" onClick={() => deleteShopping(si.id)}>Delete</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <BottomNav />
    </>
  );
}
