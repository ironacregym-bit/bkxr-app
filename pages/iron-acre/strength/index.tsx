import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import BottomNav from "../../../components/BottomNav";
import { IA, neonCardStyle } from "../../../components/iron-acre/theme";
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
  type ChartData,
  type ChartOptions,
  type ChartDataset,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

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

function formatUpdatedAt(v: any): string | null {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") {
      const d = v.toDate();
      return d && !isNaN(d.getTime()) ? d.toLocaleDateString() : null;
    }
    if (typeof v === "object" && typeof v._seconds === "number") {
      const d = new Date(v._seconds * 1000);
      return !isNaN(d.getTime()) ? d.toLocaleDateString() : null;
    }
    const d = new Date(v);
    return !isNaN(d.getTime()) ? d.toLocaleDateString() : null;
  } catch {
    return null;
  }
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
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

  const updatedLabel = useMemo(() => formatUpdatedAt(profile?.updated_at), [profile?.updated_at]);

  const checkinsKey =
    mounted && email ? `/api/checkins/series?email=${encodeURIComponent(email)}&limit=1000` : null;

  const { data: checkins, error: checkinsErr } = useSWR<CheckinsSeriesResp>(checkinsKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    shouldRetryOnError: false,
  });

  const weightDerived = useMemo(() => {
    const empty = {
      latestWeight: null as number | null,
      startWeight: null as number | null,
      delta: null as number | null,
      labels: [] as string[],
      series: [] as (number | null)[],
      chartData: null as ChartData<"line"> | null,
      chartOptions: null as ChartOptions<"line"> | null,
      subtitle: "" as string,
    };

    const rows = Array.isArray(checkins?.results) ? [...checkins!.results!] : [];
    if (!rows.length) return empty;

    // Ensure ascending by date
    rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const today = new Date();
    const start = addDays(today, -rangeDays + 1);
    const startKey = ymd(start);

    const windowRows = rows.filter((r) => String(r.date).slice(0, 10) >= startKey);

    const usable = windowRows.length ? windowRows : rows;

    const latest = [...usable].reverse().find((r) => typeof r.weight_kg === "number") || null;
    const first = usable.find((r) => typeof r.weight_kg === "number") || null;

    const latestWeight = latest?.weight_kg ?? null;
    const startWeight = first?.weight_kg ?? null;
    const delta = latestWeight != null && startWeight != null ? +(latestWeight - startWeight).toFixed(1) : null;

    const labels = usable.map((r) =>
      new Date(String(r.date)).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    );

    const series = usable.map((r) => (typeof r.weight_kg === "number" ? r.weight_kg : null));

    const cd: ChartData<"line"> = {
      labels,
      datasets: [
        {
          label: "Weight (kg)",
          data: series as (number | null)[],
          borderColor: IA.neon,
          backgroundColor: "rgba(24,255,154,0.16)",
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 4,
        } as ChartDataset<"line">,
      ],
    };

    const opts: ChartOptions<"line"> = {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { intersect: false, mode: "index" },
      },
      scales: {
        x: { ticks: { color: "#9fb0c3" }, grid: { color: "rgba(255,255,255,0.08)" } },
        y: { ticks: { color: "#9fb0c3" }, grid: { color: "rgba(255,255,255,0.08)" } },
      },
    };

    const subtitle = rangeDays === 7 ? "Last 7 days" : rangeDays === 30 ? "Last 30 days" : "Last 90 days";

    return { latestWeight, startWeight, delta, labels, series, chartData: cd, chartOptions: opts, subtitle };
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
          <section className="futuristic-card p-3" style={neonCardStyle()}>
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
  const deltaText =
    delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}kg`;
  const deltaColor =
    delta == null ? "#9fb0c3" : delta <= 0 ? IA.neon : IA.neon2;

  return (
    <>
      <Head>
        <title>Progress • Iron Acre</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        {/* Header: match the “tile header” vibe */}
        <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div className="d-flex align-items-start gap-3" style={{ minWidth: 0 }}>
              <Link
                href="/iron-acre"
                className="btn btn-sm btn-outline-light"
                style={{ borderRadius: 24, height: 34, display: "inline-flex", alignItems: "center" }}
              >
                <i className="fas fa-chevron-left" style={{ marginRight: 8 }} />
                Back
              </Link>

              <div style={{ minWidth: 0 }}>
                <div
                  className="text-dim small"
                  style={{
                    letterSpacing: 1.0,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    textTransform: "uppercase",
                  }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 10,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: `1px solid ${IA.borderSoft}`,
                      background: "rgba(0,0,0,0.20)",
                      boxShadow: IA.glowSoft,
                      color: IA.neon,
                    }}
                    aria-hidden="true"
                    title="Progress"
                  >
                    💪
                  </span>
                  PROGRESS
                </div>

                <div className="fw-bold" style={{ fontSize: "1.25rem", lineHeight: 1.15 }}>
                  Overview
                </div>

                <div className="text-dim small mt-1">
                  {weightDerived.subtitle}
                  {updatedLabel ? <span> • Updated {updatedLabel}</span> : null}
                </div>
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
                      border: `1px solid ${active ? IA.neon : IA.borderSoft}`,
                      background: active ? "rgba(24,255,154,0.14)" : "rgba(255,255,255,0.06)",
                      color: active ? IA.neon : "#fff",
                      fontWeight: 800,
                      letterSpacing: 0.5,
                      boxShadow: active ? `0 0 14px rgba(24,255,154,0.22)` : "none",
                    }}
                  >
                    {d}D
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Weight card: like the screenshot big number + chart + delta */}
        <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div style={{ minWidth: 0 }}>
              <div className="text-dim small" style={{ letterSpacing: 0.9, textTransform: "uppercase" }}>
                Weight
              </div>

              <div className="d-flex align-items-end gap-2" style={{ marginTop: 6 }}>
                <div style={{ fontSize: "2.1rem", fontWeight: 900, lineHeight: 1, color: "#fff" }}>
                  {weightDerived.latestWeight != null ? weightDerived.latestWeight.toFixed(1) : "—"}
                </div>
                <div className="text-dim" style={{ paddingBottom: 4 }}>
                  kg
                </div>
              </div>

              <div className="text-dim small mt-1">
                {rangeDays}d avg:{" "}
                <span style={{ color: "#fff", fontWeight: 700 }}>
                  {weightDerived.startWeight != null ? weightDerived.startWeight.toFixed(1) : "—"}kg
                </span>
                <span style={{ marginLeft: 10, color: deltaColor, fontWeight: 800 }}>
                  {deltaText}
                </span>
              </div>
            </div>

            <Link href="/checkin" className="btn btn-sm btn-outline-light" style={{ borderRadius: 24 }}>
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

        {/* Strength tiles: 2x2 grid like the screenshot */}
        <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="text-dim small" style={{ letterSpacing: 0.9, textTransform: "uppercase" }}>
              Strength
            </div>
            <span
              className="badge"
              style={{
                background: `rgba(24,255,154,0.12)`,
                color: IA.neon,
                border: `1px solid ${IA.borderSoft}`,
              }}
            >
              e1RM + 1RM
            </span>
          </div>

          <div className="row g-2">
            {BIG_LIFTS.map((lift) => {
              const { true1rm, trainingMax } = resolveProfileLift(profile, lift);
              const value = true1rm ?? trainingMax ?? null;

              return (
                <div key={lift.key} className="col-6">
                  <Link
                    href={`/iron-acre/strength/${lift.key}`}
                    className="d-block"
                    style={{ textDecoration: "none", color: "#fff" }}
                    aria-label={`Open ${lift.label} strength details`}
                  >
                    <div
                      className="p-3"
                      style={{
                        borderRadius: 14,
                        border: `1px solid ${IA.borderSoft}`,
                        background: "rgba(0,0,0,0.22)",
                        boxShadow: IA.glowSoft,
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
                        <div style={{ marginTop: 6, fontSize: "1.4rem", fontWeight: 900 }}>
                          {value != null ? (
                            <span style={{ color: IA.neon, textShadow: `0 0 10px ${IA.neon}40` }}>
                              {value}
                            </span>
                          ) : (
                            <span className="text-dim">—</span>
                          )}
                          <span className="text-dim" style={{ marginLeft: 6, fontSize: ".95rem", fontWeight: 700 }}>
                            kg
                          </span>
                        </div>
                        <div className="text-dim small mt-1">
                          {true1rm != null ? "True 1RM" : trainingMax != null ? "Training max" : "No data"}
                        </div>
                      </div>

                      {/* mini “spark line” placeholder bar (visual only) */}
                      <div
                        style={{
                          height: 8,
                          borderRadius: 999,
                          border: `1px solid ${IA.borderSoft}`,
                          background: "rgba(255,255,255,0.06)",
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
