import Head from "next/head"; Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import BottomNav from "../../../components/BottomNav";
import { IA } from "../../../components/iron-acre/theme";
import { BIG_LIFTS, resolveProfileLift, type StrengthProfile } from "../../../lib/iron-acre/strengthLifts";

// Chart.js
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
  type ChartData,
  type ChartOptions,
  type ChartDataset,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

const fetcher = async (u: string) => {
  const r = await fetch(u);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `Request failed (${r.status})`);
  return j;
};

type CheckinRow = {
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
};

type CheckinsSeriesResp = { results: CheckinRow[] };

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Robust date normaliser -> YYYY-MM-DD or null
function toYMD(v: any): string | null {
  try {
    if (!v) return null;

    // If it's already YYYY-MM-DD
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

    // If it's ISO string or Date string
    const d = new Date(v);
    if (!isNaN(d.getTime())) return ymd(d);

    return null;
  } catch {
    return null;
  }
}

// Format X-axis labels compact like the reference (e.g. 19/01, 27/01)
function fmtShortDay(ymdStr: string) {
  const d = new Date(`${ymdStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
}

export default function IronAcreStrengthIndexPage() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);

  const { data } = useSWR(mounted ? "/api/strength/profile/get" : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const profile: StrengthProfile | undefined = data?.profile;
  const email: string | null = session?.user?.email ? String(session.user.email) : null;

  const checkinsKey = mounted && email ? `/api/checkins/series?email=${encodeURIComponent(email)}&limit=1000` : null;

  const { data: checkins, error: checkinsErr } = useSWR<CheckinsSeriesResp>(checkinsKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    shouldRetryOnError: false,
  });

  // Style tokens to match the reference
  const tileBg = "rgba(255,255,255,0.06)";
  const tileShadow = "0 18px 40px rgba(0,0,0,0.35)";
  const tileRadius = 18;

  const weightDerived = useMemo(() => {
    const subtitle = rangeDays === 7 ? "Last 7 days" : rangeDays === 30 ? "Last 30 days" : "Last 90 days";

    const empty = {
      latestWeight: null as number | null,
      startWeight: null as number | null,
      avgWeight: null as number | null,
      delta: null as number | null,
      chartData: null as ChartData<"line"> | null,
      chartOptions: null as ChartOptions<"line"> | null,
      subtitle,
      windowCount: 0,
    };

    const raw = Array.isArray(checkins?.results) ? checkins!.results! : [];
    if (!raw.length) return empty;

    // Normalise + keep only rows that have a valid date
    const rows = raw
      .map((r) => ({
        ...r,
        ymd: toYMD(r.date),
      }))
      .filter((r) => Boolean(r.ymd)) as Array<CheckinRow & { ymd: string }>;

    if (!rows.length) return empty;

    // Sort ascending by YMD
    rows.sort((a, b) => a.ymd.localeCompare(b.ymd));

    // Correct window: inclusive start -> today
    const today = new Date();
    const endKey = ymd(today);
    const start = addDays(today, -(rangeDays - 1));
    const startKey = ymd(start);

    const windowRows = rows.filter((r) => r.ymd >= startKey && r.ymd <= endKey);

    // If no rows in the window (e.g. no recent check-ins), fall back to latest N check-ins
    const usable = windowRows.length
      ? windowRows
      : rows.slice(Math.max(0, rows.length - rangeDays));

    const latest = [...usable].reverse().find((r) => typeof r.weight_kg === "number") || null;
    const first = usable.find((r) => typeof r.weight_kg === "number") || null;

    const latestWeight = latest?.weight_kg ?? null;
    const startWeight = first?.weight_kg ?? null;
    const delta = latestWeight != null && startWeight != null ? +(latestWeight - startWeight).toFixed(1) : null;

    const weightVals = usable.map((r) => (typeof r.weight_kg === "number" ? r.weight_kg : null)).filter((x): x is number => x != null);
    const avgWeight = weightVals.length ? +(weightVals.reduce((a, b) => a + b, 0) / weightVals.length).toFixed(1) : null;

    // X labels (dates)
    const labels = usable.map((r) => fmtShortDay(r.ymd));
    const series = usable.map((r) => (typeof r.weight_kg === "number" ? r.weight_kg : null));

    const cd: ChartData<"line"> = {
      labels,
      datasets: [
        {
          label: "Weight (kg)",
          data: series as (number | null)[],
          borderColor: IA.neon,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0.35,
          fill: true,
          backgroundColor: (ctx: any) => {
            const chart = ctx.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return "rgba(24,255,154,0.12)";
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, "rgba(24,255,154,0.22)");
            g.addColorStop(1, "rgba(24,255,154,0.00)");
            return g;
          },
        } as ChartDataset<"line">,
      ],
    };

    // ✅ X axis ON (labels), Y axis numbers ON, NO grid lines
    const opts: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { intersect: false, mode: "index" },
      },
      scales: {
        x: {
          display: true,
          grid: { display: false },        // no vertical grid lines
          border: { display: false },      // no axis baseline line
          ticks: {
            display: true,
            color: "#9fb0c3",
            autoSkip: true,
            maxTicksLimit: rangeDays === 7 ? 7 : rangeDays === 30 ? 6 : 7,
            maxRotation: 0,
            minRotation: 0,
            padding: 6,
          },
        },
        y: {
          display: true,
          grid: { display: false },        // no horizontal grid lines
          border: { display: false },      // no axis line
          ticks: {
            display: true,
            color: "#9fb0c3",
            padding: 6,
            maxTicksLimit: 6,
          },
        },
      },
    };

    return { latestWeight, startWeight, avgWeight, delta, chartData: cd, chartOptions: opts, subtitle, windowCount: usable.length };
  }, [checkins, rangeDays]);

  if (!mounted) return null;

  if (status === "loading") {
    return (
      <main className="container py-4" style={{ color: "#fff" }}>
        Loading…
      </main>
    );
  }

  if (!session) {
    const cb = encodeURIComponent("/iron-acre/strength");
    return (
      <>
        <Head>
          <title>Progress • Iron Acre</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </Head>

        <main className="container py-4" style={{ color: "#fff", paddingBottom: 90 }}>
          <section className="futuristic-card p-3" style={{ borderRadius: tileRadius, background: tileBg, boxShadow: tileShadow }}>
            <h2 className="m-0">Progress</h2>
            <div className="text-dim mt-2">Please sign in to view your progress.</div>
            <div className="mt-3">
              <Link href={`/register?callbackUrl=${cb}`} className="btn btn-outline-light" style={{ borderRadius: 24 }}>
                Sign in
              </Link>
            </div>
          </section>
        </main>

        <BottomNav />
      </>
    );
  }

  const delta = weightDerived.delta;
  const deltaText = delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}kg`;
  const deltaColor = delta == null ? "#9fb0c3" : delta <= 0 ? IA.neon : IA.neon2;

  return (
    <>
      <Head>
        <title>Progress • Iron Acre</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        {/* Header */}
        <section
          className="futuristic-card p-3 mb-3"
          style={{
            borderRadius: tileRadius,
            background: tileBg,
            boxShadow: tileShadow,
          }}
        >
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div className="d-flex align-items-start gap-3" style={{ minWidth: 0 }}>
              <Link
                href="/iron-acre"
                className="btn btn-sm btn-outline-light"
                style={{
                  borderRadius: 999,
                  padding: "8px 12px",
                  color: "#fff",
                  border: "none",
                  background: "rgba(255,255,255,0.08)",
                }}
              >
                <i className="fas fa-chevron-left" style={{ marginRight: 8 }} />
                Back
              </Link>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "1.65rem",
                    fontWeight: 950,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    lineHeight: 1.1,
                  }}
                >
                  PROGRESS
                </div>
                <div className="text-dim small mt-1">{weightDerived.subtitle}</div>
              </div>
            </div>

            {/* Range pills */}
            <div className="d-flex align-items-center gap-2">
              {[7, 30, 90].map((d) => {
                const active = rangeDays === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setRangeDays(d as 7 | 30 | 90)}
                    className="btn btn-sm"
                    style={{
                      borderRadius: 18,
                      padding: "6px 10px",
                      border: "none",
                      background: active ? "rgba(24,255,154,0.18)" : "rgba(255,255,255,0.08)",
                      color: active ? IA.neon : "#fff",
                      fontWeight: 900,
                      letterSpacing: 0.5,
                      boxShadow: active ? `0 0 14px rgba(24,255,154,0.18)` : "none",
                    }}
                  >
                    {d}D
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Weight tile */}
        <section
          className="futuristic-card p-3 mb-3"
          style={{
            borderRadius: tileRadius,
            background: tileBg,
            boxShadow: tileShadow,
          }}
        >
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div style={{ minWidth: 0 }}>
              <div className="text-dim small" style={{ letterSpacing: 0.9, textTransform: "uppercase" }}>
                WEIGHT
              </div>

              <div className="d-flex align-items-end gap-2" style={{ marginTop: 6 }}>
                <div style={{ fontSize: "2.1rem", fontWeight: 950, lineHeight: 1, color: "#fff" }}>
                  {weightDerived.latestWeight != null ? weightDerived.latestWeight.toFixed(1) : "—"}
                </div>
                <div className="text-dim" style={{ paddingBottom: 4 }}>
                  kg
                </div>
              </div>

              <div className="text-dim small mt-1">
                {rangeDays}d avg:{" "}
                <span style={{ color: "#fff", fontWeight: 800 }}>
                  {weightDerived.avgWeight != null ? weightDerived.avgWeight.toFixed(1) : "—"}kg
                </span>
                <span style={{ marginLeft: 10, color: deltaColor, fontWeight: 900 }}>
                  {deltaText}
                </span>
              </div>
            </div>

            <Link
              href="/checkin"
              className="btn btn-sm"
              style={{
                borderRadius: 999,
                padding: "8px 12px",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                border: "none",
              }}
            >
              Add check-in
            </Link>
          </div>

          <div className="mt-3" style={{ height: 240 }}>
            {checkinsErr ? (
              <div className="text-dim">No check-ins yet.</div>
            ) : weightDerived.chartData ? (
              <Line data={weightDerived.chartData} options={weightDerived.chartOptions as any} />
            ) : (
              <div className="text-dim">No check-ins yet.</div>
            )}
          </div>
        </section>

        {/* Strength tiles wrapper remains transparent */}
        <section className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2" style={{ paddingLeft: 4, paddingRight: 4 }}>
            <div className="text-dim small" style={{ letterSpacing: 0.9, textTransform: "uppercase" }}>
              STRENGTH
            </div>

            <span
              className="badge"
              style={{
                background: `rgba(24,255,154,0.12)`,
                color: IA.neon,
                border: "none",
              }}
            >
              e1RM + 1RM
            </span>
          </div>

          <div className="row g-2">
            {BIG_LIFTS.map((lift) => {
              const { true1rm, trainingMax } = resolveProfileLift(profile as any, lift);
              const value = true1rm ?? trainingMax ?? null;

              return (
                <div key={lift.key} className="col-6">
                  <Link href={`/iron-acre/strength/${lift.key}`} style={{ textDecoration: "none", color: "#fff" }}>
                    <div
                      className="p-3"
                      style={{
                        borderRadius: 16,
                        border: "none",
                        background: "rgba(255,255,255,0.07)",
                        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
                        minHeight: 112,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div className="text-dim small" style={{ letterSpacing: 0.8, textTransform: "uppercase" }}>
                          {lift.label}
                        </div>

                        <div style={{ marginTop: 6, fontSize: "1.4rem", fontWeight: 950 }}>
                          {value != null ? (
                            <span style={{ color: IA.neon, textShadow: `0 0 10px ${IA.neon}40` }}>{value}</span>
                          ) : (
                            <span className="text-dim">—</span>
                          )}
                          <span className="text-dim" style={{ marginLeft: 6, fontSize: ".95rem", fontWeight: 800 }}>
                            kg
                          </span>
                        </div>

                        <div className="text-dim small mt-1">
                          {true1rm != null ? "True 1RM" : trainingMax != null ? "Training max" : "No data"}
                        </div>
                      </div>

                      <div
                        style={{
                          height: 8,
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.08)",
                          overflow: "hidden",
                          marginTop: 10,
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: value != null ? "72%" : "22%",
                            background: `linear-gradient(90deg, ${IA.neon}CC, ${IA.neon2}99)`,
                            opacity: value != null ? 1 : 0.35,
                          }}
                        />
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}
