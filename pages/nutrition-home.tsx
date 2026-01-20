
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
  const safeTarget = target && target > 0 ? Number(target) : null;
  const pct = safeTarget ? Math.min(100, Math.round((val / safeTarget) * 100)) : 0;

  return (
    <div className="mb-2">
      <div className="d-flex justify-content-between align-items-center mb-1">
        <span className="text-dim">{label}</span>
        <span className="fw-semibold">
          {Math.round(val)}
          {unit}
          {safeTarget ? ` / ${Math.round(safeTarget)}${unit}` : ""}
        </span>
      </div>
      {/* Progress bar — glassy capacity track with neon accent fill */}
      {safeTarget ? (
        <div className="capacity" aria-label={`${label} progress`}>
          <div className="bar" style={{ background: "rgba(255,255,255,0.06)" }}>
            <span
              style={{
                width: `${pct}%`,
                background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                boxShadow: `0 0 10px ${ACCENT}55`,
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function NutritionHome() {
  const { status, data: session } = useSession();
  const authed = status === "authenticated";
  const email = session?.user?.email ?? "";

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Today’s nutrition log (source of truth for totals) — correct endpoint
  const { data: entriesResp } = useSWR<{ entries: any[] }>(
    authed && email ? `/api/nutrition/logs` : null,
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

  // Macro targets (caloric + P/C/F) — page only reads, no logic changes
  const { data: planGet } = useSWR<{ targets: Totals | null }>(
    authed ? `/api/mealplan/get` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30_000 }
  );
  const targets = planGet?.targets || null;

  // Read-only shopping list preview (first few items)
  const { data: listData } = useSWR<{ items: ShoppingItem[] }>(
    authed ? `/api/shopping/lists` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30_000 }
  );
  const shopping = useMemo(() => (listData?.items || []).slice(0, 6), [listData]);

  // Build shopping list (server should default to "today")
  async function generateShoppingFromPlan() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/shopping/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // no date passed
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to generate list");
      setMsg(`Shopping list updated • ${j?.added ?? 0} items added`);
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

        {/* Tiles: left = Today macros; right = Shopping preview/CTAs */}
        <section className="row gx-3">
          {/* Today macros (from logged entries) — Full tile clickable to log page */}
          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-0" style={{ height: "100%", overflow: "hidden" }}>
              {/* Linked body (no nested links inside this block) */}
              <Link
                href="/nutrition"
                className="d-block p-3 text-decoration-none"
                style={{ color: "inherit" }}
                aria-label="Open Log Nutrition"
              >
                <h6 className="mb-2" style={{ fontWeight: 700 }}>
                  Today
                </h6>
                <MacroBar label="Calories" val={totals.calories} target={targets?.calories ?? null} />
                <MacroBar label="Protein" val={totals.protein_g} target={targets?.protein_g ?? null} unit="g" />
                <MacroBar label="Carbs" val={totals.carbs_g} target={targets?.carbs_g ?? null} unit="g" />
                <MacroBar label="Fat" val={totals.fat_g} target={targets?.fat_g ?? null} unit="g" />
                <div className="text-dim" style={{ fontSize: 12 }}>
                  Totals are from what you’ve logged today. Targets come from your profile (P/C/F split).
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

          {/* Shopping preview + CTAs (read-only) */}
          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-3" style={{ height: "100%" }}>
              <div className="d-flex align-items-center justify-content-between mb-2" style={{ gap: 8 }}>
                <h6 className="m-0" style={{ fontWeight: 700 }}>
                  Shopping
                </h6>
              </div>

              <div className="d-flex flex-wrap mb-2" style={{ gap: 8 }}>
                <button
                  className="btn btn-sm"
                  onClick={generateShoppingFromPlan}
                  disabled={busy}
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
                <Link href="/recipes" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
                  Recipes
                </Link>
              </div>

              {/* Read-only preview */}
              {!shopping.length ? (
                <div className="text-dim">No shopping items yet. Build a list from your meal plan.</div>
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
