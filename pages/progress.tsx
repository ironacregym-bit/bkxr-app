
// pages/progress.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";

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

const fetcher = (u: string) => fetch(u).then((r) => {
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
});

// ---- Helpers
const ACCENT = "#FF8A2A";
const fmtYMD = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const toISO = (v: any) => {
  try {
    const d = v?.toDate?.() instanceof Date ? v.toDate() : v ? new Date(v) : null;
    return d && !isNaN(d.getTime()) ? d.toISOString() : null;
  } catch { return null; }
};

// ---- Shapes
type Completion = {
  id?: string;
  user_email?: string | null;
  is_freestyle?: boolean;
  activity_type?: string | null;
  duration_minutes?: number | null;
  calories_burned?: number | null;
  rpe?: number | null;
  is_benchmark?: boolean;
  benchmark_metrics?: Record<string, any> | null;
  workout_id?: string | null;
  sets_completed?: number | null;
  weight_completed_with?: number | null;
  completed_date?: string | { toDate?: () => Date } | null;
  started_at?: string | { toDate?: () => Date } | null;
  created_at?: string | { toDate?: () => Date } | null;
};

type CompletionsIndexResp = {
  results?: Completion[];
  items?: Completion[];
  completions?: Completion[];
  data?: Completion[];
  nextCursor?: string | null;
};

type CheckinRow = { date: string; weight_kg: number | null; body_fat_pct: number | null; photo_url?: string | null };
type CheckinsSeriesResp = { results: CheckinRow[] };

// ---- Page
export default function ProgressPage() {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const email = session?.user?.email || null;

  // Window for stats
  const now = new Date();
  const fromDate = addDays(new Date(now), -90);
  const fromKey = fmtYMD(fromDate);
  const toKey = fmtYMD(now);

  // Completions (90d) via your single endpoint
  const completionsKey = mounted && email
    ? `/api/completions/index?from=${encodeURIComponent(fromKey)}&to=${encodeURIComponent(toKey)}&user_email=${encodeURIComponent(email)}&limit=500`
    : null;

  const { data: compsData } = useSWR<CompletionsIndexResp>(completionsKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  // Check-ins (optional). If this API isn’t present, we soft-fail in UI
  const checkinsKey = mounted && email
    ? `/api/checkins/series?email=${encodeURIComponent(email)}&limit=180`
    : null;

  const { data: checkins, error: checkinsErr } = useSWR<CheckinsSeriesResp>(checkinsKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    shouldRetryOnError: false,
  });

  // Normalised completions source
  const comps: Completion[] = useMemo(() => {
    const src = compsData?.results || compsData?.items || compsData?.completions || compsData?.data || [];
    return Array.isArray(src) ? src : [];
  }, [compsData]);

  // Aggregate daily calories and sessions
  const daily = useMemo(() => {
    const map: Record<string, { calories: number; sessions: number }> = {};
    const daySet = new Set<string>();
    let totalCalories = 0;
    let totalSessions = 0;
    const loads: { weight_kg: number; when: string }[] = [];

    for (const c of comps) {
      const iso =
        toISO((c as any).completed_date) ||
        toISO((c as any).started_at) ||
        toISO((c as any).created_at);
      if (!iso) continue;

      const key = iso.slice(0, 10);
      const cal = Number(c.calories_burned) || 0;
      totalCalories += cal; totalSessions += 1; daySet.add(key);

      if (!map[key]) map[key] = { calories: 0, sessions: 0 };
      map[key].calories += cal;
      map[key].sessions += 1;

      // Heaviest weights from both aggregate and benchmark parts
      const aggW = Number(c.weight_completed_with);
      if (Number.isFinite(aggW) && aggW > 0) loads.push({ weight_kg: aggW, when: iso });
      if (c.benchmark_metrics && typeof c.benchmark_metrics === "object") {
        for (const [, part] of Object.entries(c.benchmark_metrics)) {
          const w = Number((part as any)?.weight_kg);
          if (Number.isFinite(w) && w > 0) loads.push({ weight_kg: w, when: iso });
        }
      }
    }

    // Current streak: consecutive days up to today that appear in daySet
    let currentStreak = 0;
    for (let i = 0; i < 365; i++) {
      const d = addDays(new Date(now), -i);
      const k = fmtYMD(d);
      if (daySet.has(k)) currentStreak++;
      else break;
    }

    // Max streak in window
    let maxStreak = 0, run = 0;
    for (let i = 90; i >= 0; i--) {
      const d = addDays(new Date(now), -i);
      const k = fmtYMD(d);
      if (daySet.has(k)) { run++; maxStreak = Math.max(maxStreak, run); } else run = 0;
    }

    const series = Object.entries(map)
      .map(([dateKey, v]) => ({ dateKey, ...v }))
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    const topLoads = loads.sort((a, b) => b.weight_kg - a.weight_kg).slice(0, 5);

    return {
      series,
      totals: { sessions: totalSessions, calories: totalCalories },
      currentStreak,
      maxStreak,
      topLoads,
    };
  }, [comps, now]);

  // Latest check-in (newest first expected from /checkins/series)
  const latestCheckin = useMemo<CheckinRow | null>(() => {
    const arr = checkins?.results || [];
    return arr.length ? arr[0] : null;
  }, [checkins]);

  // ---- Charts (typed to avoid readonly dataset build errors)
  const weightChart = useMemo(() => {
    const src = (checkins?.results || []).slice().reverse(); // ascend
    const labels = src.map(r => new Date(r.date).toLocaleDateString(undefined, { day: "numeric", month: "short" }));
    const data = src.map(r => (typeof r.weight_kg === "number" ? r.weight_kg : null));
    const chartData: ChartData<"line"> = {
      labels,
      datasets: [
        {
          label: "Weight (kg)",
          data: data as (number | null)[],
          borderColor: "#4fa3a5",
          backgroundColor: "rgba(79,163,165,0.25)",
          tension: 0.3,
          pointRadius: 2,
        } as ChartDataset<"line">,
      ],
    };
    const options: ChartOptions<"line"> = {
      responsive: true,
      plugins: { legend: { labels: { color: "#e9eef6" } } },
      scales: {
        x: { ticks: { color: "#9fb0c3" }, grid: { color: "rgba(255,255,255,0.08)" } },
        y: { ticks: { color: "#9fb0c3" }, grid: { color: "rgba(255,255,255,0.08)" } },
      },
    };
    return { chartData, options };
  }, [checkins]);

  const bodyFatChart = useMemo(() => {
    const src = (checkins?.results || []).slice().reverse();
    const labels = src.map(r => new Date(r.date).toLocaleDateString(undefined, { day: "numeric", month: "short" }));
    const data = src.map(r => (typeof r.body_fat_pct === "number" ? r.body_fat_pct : null));
    const chartData: ChartData<"line"> = {
      labels,
      datasets: [
        {
          label: "Body fat (%)",
          data: data as (number | null)[],
          borderColor: "#ff4fa3",
          backgroundColor: "rgba(255,79,163,0.25)",
          tension: 0.3,
          pointRadius: 2,
        } as ChartDataset<"line">,
      ],
    };
    const options: ChartOptions<"line"> = {
      responsive: true,
      plugins: { legend: { labels: { color: "#e9eef6" } } },
      scales: {
        x: { ticks: { color: "#9fb0c3" }, grid: { color: "rgba(255,255,255,0.08)" } },
        y: { ticks: { color: "#9fb0c3" }, grid: { color: "rgba(255,255,255,0.08)" } },
      },
    };
    return { chartData, options };
  }, [checkins]);

  const caloriesChart = useMemo(() => {
    const src = daily.series; // already ascending
    const labels = src.map(r => new Date(r.dateKey).toLocaleDateString(undefined, { day: "numeric", month: "short" }));
    const data = src.map(r => r.calories);
    const chartData: ChartData<"line"> = {
      labels,
      datasets: [
        {
          label: "Calories burned",
          data,
          borderColor: ACCENT,
          backgroundColor: "rgba(255,138,42,0.25)",
          tension: 0.3,
          pointRadius: 2,
        } as ChartDataset<"line">,
      ],
    };
    const options: ChartOptions<"line"> = {
      responsive: true,
      plugins: { legend: { labels: { color: "#e9eef6" } } },
      scales: {
        x: { ticks: { color: "#9fb0c3" }, grid: { color: "rgba(255,255,255,0.08)" } },
        y: { ticks: { color: "#9fb0c3" }, grid: { color: "rgba(255,255,255,0.08)" } },
      },
    };
    return { chartData, options };
  }, [daily.series]);

  const kpis = useMemo(() => ({
    sessions: daily.totals.sessions,
    calories: daily.totals.calories,
    currentStreak: daily.currentStreak,
    maxStreak: daily.maxStreak,
  }), [daily]);

  const topLoads = daily.topLoads;

  return (
    <>
      <Head>
        <title>Progress • BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="mobile-web-app-capable" content="yes" />
      </Head>

      <main className="container py-3" style={{ paddingBottom: 90, color: "#fff", borderRadius: 12, minHeight: "100vh" }}>
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h1 className="h4 mb-0" style={{ fontWeight: 700 }}>Progress</h1>
            <small className="text-dim">Trends, check‑ins, and recent lifts</small>
          </div>
          <div className="d-flex gap-2">
            <Link href="/checkin" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
              Add check‑in
            </Link>
            <a
              href="https://bkxr-app.vercel.app/schedule"
              className="btn btn-sm"
              style={{
                borderRadius: 24,
                color: "#fff",
                background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                boxShadow: `0 0 14px ${ACCENT}66`,
              }}
              target="_blank"
              rel="noopener noreferrer"
            >
              Book a class
            </a>
          </div>
        </div>

        {/* KPIs */}
        <section className="row gx-3">
          <div className="col-6 col-md-3 mb-3">
            <div className="futuristic-card p-3">
              <div className="small text-dim">Sessions (90d)</div>
              <div className="h4 m-0">{kpis.sessions}</div>
            </div>
          </div>
          <div className="col-6 col-md-3 mb-3">
            <div className="futuristic-card p-3">
              <div className="small text-dim">Calories (90d)</div>
              <div className="h4 m-0">{kpis.calories}</div>
            </div>
          </div>
          <div className="col-6 col-md-3 mb-3">
            <div className="futuristic-card p-3">
              <div className="small text-dim">Current streak</div>
              <div className="h4 m-0">{kpis.currentStreak} days</div>
            </div>
          </div>
          <div className="col-6 col-md-3 mb-3">
            <div className="futuristic-card p-3">
              <div className="small text-dim">Max streak</div>
              <div className="h4 m-0">{kpis.maxStreak} days</div>
            </div>
          </div>
        </section>

        {/* Charts */}
        <section className="row gx-3">
          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-3">
              <h6 className="mb-2" style={{ fontWeight: 700 }}>Weight</h6>
              {checkinsErr
                ? <div className="text-dim">No check‑ins yet.</div>
                : <Line data={weightChart.chartData} options={weightChart.options} />
              }
            </div>
          </div>

          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-3">
              <h6 className="mb-2" style={{ fontWeight: 700 }}>Body fat</h6>
              {checkinsErr
                ? <div className="text-dim">No check‑ins yet.</div>
                : <Line data={bodyFatChart.chartData} options={bodyFatChart.options} />
              }
            </div>
          </div>

          <div className="col-12 mb-3">
            <div className="futuristic-card p-3">
              <h6 className="mb-2" style={{ fontWeight: 700 }}>Calories burned (daily)</h6>
              <Line data={caloriesChart.chartData} options={caloriesChart.options} />
            </div>
          </div>
        </section>

        {/* Recent kettlebell loads + Latest check-in */}
        <section className="row gx-3">
          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-3">
              <h6 className="mb-2" style={{ fontWeight: 700 }}>Recent loads (heaviest)</h6>
              {topLoads.length ? (
                <ul className="m-0" style={{ paddingLeft: 18 }}>
                  {topLoads.map((l, i) => (
                    <li key={`${l.when}-${i}`} className="mb-1">
                      <span className="fw-semibold">{l.weight_kg} kg</span>
                      <span className="text-dim"> • {new Date(l.when).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-dim">No loads recorded yet.</div>
              )}
            </div>
          </div>

          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-3">
              <h6 className="mb-2" style={{ fontWeight: 700 }}>Latest check‑in</h6>
              {!checkinsErr && latestCheckin ? (
                <div className="d-flex justify-content-between">
                  <div>
                    <div className="small text-dim">{new Date(latestCheckin.date).toLocaleDateString()}</div>
                    <div className="fw-semibold">
                      {typeof latestCheckin.weight_kg === "number" ? `${latestCheckin.weight_kg} kg` : "—"}{" "}
                      · {typeof latestCheckin.body_fat_pct === "number" ? `${latestCheckin.body_fat_pct}%` : "—"}
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <Link href="/checkin" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
                      View check‑ins
                    </Link>
                    <Link href="/photos" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
                      Photos
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-dim">No check‑ins yet. Add one to start seeing trends.</div>
              )}
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}
