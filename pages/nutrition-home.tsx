
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

// ---- Brand ------------------------------------------------------------------
const ACCENT = "#FF8A2A";

// ---- Small date helpers -----------------------------------------------------
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

// ---- UI bits ----------------------------------------------------------------
function MacroBar({
  label,
  val,
  target,
  unit = "",
}: {
  label: string;
  val: number;
  target?: number | null;
  unit?: string;
}) {
  const safeTarget = target && target > 0 ? target : null;
  const pct = safeTarget ? Math.min(100, Math.round((val / safeTarget) * 100)) : 0;
  return (
    <div className="mb-2">
      <div className="d-flex justify-content-between">
        <span className="text-dim">{label}</span>
        <span>
          {Math.round(val)}
          {unit}
          {safeTarget ? ` / ${Math.round(safeTarget)}${unit}` : ""}
        </span>
      </div>
      {safeTarget ? (
        <div className="capacity">
          <div className="bar">
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---- Page -------------------------------------------------------------------
export default function NutritionHome() {
  const { status, data: session } = useSession();
  const authed = status === "authenticated";
  const email = session?.user?.email ?? "";

  const [date, setDate] = useState<string>(todayYMD());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Log entries for the selected day (source of truth for totals)
  const { data: entriesResp } = useSWR<{ entries: any[] }>(
    authed && email ? `/api/nutrition?date=${encodeURIComponent(date)}` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30_000 }
  );

  // Compute totals from the log entries
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

  // Optional macro targets (unchanged behaviour)
  const { data: planGet } = useSWR<{ targets: Totals | null }>(
    authed ? `/api/mealplan/get?date=${encodeURIComponent(date)}` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30_000 }
  );
  const targets = planGet?.targets || null;

  // Shopping list preview
  const {
    data: listData,
    mutate: listMutate,
  } = useSWR<{ items: ShoppingItem[] }>(authed ? `/api/shopping/list` : null, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
  });
  const shopping = useMemo(() => (listData?.items || []).slice(0, 10), [listData]);

  // Add item form state
  const [newItem, setNewItem] = useState("");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("");

  // ---- Shopping actions -----------------------------------------------------
  async function addShoppingItem() {
    if (!newItem.trim()) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/shopping/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newItem.trim(),
          qty: newQty ? Number(newQty) : null,
          unit: newUnit || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to add");
      setNewItem("");
      setNewQty("");
      setNewUnit("");
      listMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to add item");
    } finally {
      setBusy(false);
    }
  }
  async function toggleShoppingDone(id: string, done: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/shopping/list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, done: !done }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to update item");
      listMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to update item");
    } finally {
      setBusy(false);
    }
  }
  async function deleteShopping(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/shopping/list", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to delete item");
      listMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to delete item");
    } finally {
      setBusy(false);
    }
  }
  async function generateShoppingFromPlan() {
    // Adds items, does not remove existing
    if (!confirm("Generate a shopping list from today’s meal plan? This adds items (it won’t remove existing).")) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/shopping/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to generate list");
      setMsg(`Shopping list updated • ${j?.added ?? 0} items added`);
      listMutate();
    } catch (e: any) {
      setMsg(e?.message || "Failed to generate list");
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
        {/* Header: match Train page style */}
        <div className="mb-3">
          <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 8 }}>
            <div>
              <h1 className="h4 mb-0" style={{ fontWeight: 700 }}>
                Nutrition
              </h1>
              <small style={{ opacity: 0.75 }}>Fuel the work</small>
            </div>

            {/* Date switcher + CTAs */}
            <div className="d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
              <div className="d-flex align-items-center" style={{ gap: 8 }}>
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

              <div className="d-flex" style={{ gap: 8 }}>
                <Link className="btn btn-bxkr btn-sm" href="/nutrition" style={{ borderRadius: 24 }}>
                  Log Nutrition
                </Link>
                <Link className="btn btn-bxkr btn-sm" href="/recipes" style={{ borderRadius: 24 }}>
                  Recipes
                </Link>
                <button className="btn btn-sm" onClick={generateShoppingFromPlan} disabled={busy}
                  style={{
                    borderRadius: 24,
                    color: "#fff",
                    background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                    boxShadow: `0 0 14px ${ACCENT}66`,
                    border: "none",
                    paddingInline: 14,
                  }}
                >
                  Build Shopping List
                </button>
              </div>
            </div>
          </div>
          {msg && <div className="alert alert-info mt-2 mb-0">{msg}</div>}
        </div>

        {/* Tiles: left = Today macros; right = Shopping list */}
        <section className="row gx-3">
          {/* Today macros (from logged entries) */}
          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-3" style={{ height: "100%" }}>
              <h6 className="mb-2" style={{ fontWeight: 700 }}>
                Today
              </h6>
              <MacroBar label="Calories" val={totals.calories} target={targets?.calories ?? null} />
              <MacroBar label="Protein" val={totals.protein_g} target={targets?.protein_g ?? null} unit="g" />
              <MacroBar label="Carbs" val={totals.carbs_g} target={targets?.carbs_g ?? null} unit="g" />
              <MacroBar label="Fat" val={totals.fat_g} target={targets?.fat_g ?? null} unit="g" />
              <div className="text-dim" style={{ fontSize: 12 }}>
                These totals are from what you’ve logged today. Targets come from your profile (P/C/F split).
              </div>
            </div>
          </div>

          {/* Shopping list */}
          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-3" style={{ height: "100%" }}>
              <div className="d-flex align-items-center justify-content-between mb-2" style={{ gap: 8 }}>
                <h6 className="m-0" style={{ fontWeight: 700 }}>
                  Shopping List
                </h6>
              </div>

              {/* Add row */}
              <div className="d-flex flex-wrap" style={{ gap: 8, width: "100%" }}>
                <input
                  className="form-control"
                  placeholder="Item…"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  style={{ minWidth: 160, flex: 1 }}
                />
                <input
                  className="form-control"
                  placeholder="Qty"
                  value={newQty}
                  onChange={(e) => setNewQty(e.target.value)}
                  style={{ maxWidth: 90 }}
                />
                <input
                  className="form-control"
                  placeholder="Unit"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  style={{ maxWidth: 100 }}
                />
                <button className="btn-bxkr" onClick={addShoppingItem} disabled={busy || !newItem.trim()}>
                  Add
                </button>
              </div>

              {/* Items */}
              <div className="mt-2">
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
                        <div className="d-flex align-items-center" style={{ gap: 10 }}>
                          <input
                            type="checkbox"
                            className="form-check-input habit-check"
                            checked={!!si.done}
                            onChange={() => toggleShoppingDone(si.id, !!si.done)}
                            aria-label={`Mark ${si.name} ${si.done ? "not done" : "done"}`}
                          />
                          <div>
                            <div className="fw-semibold">{si.name}</div>
                            <div className="text-dim" style={{ fontSize: 12 }}>
                              {(si.qty ?? "-")} {si.unit ?? ""}
                            </div>
                          </div>
                        </div>
                        <button className="btn-bxkr-outline" onClick={() => deleteShopping(si.id)}>
                          Delete
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}
