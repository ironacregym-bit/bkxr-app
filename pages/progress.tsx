// pages/progress.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
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

const fetcher = (u: string) =>
  fetch(u).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });

// ---- Helpers ---------------------------------------------------------------
const ACCENT = "#FF8A2A";
const fmtYMD = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** Robust Firestore timestamp parser:
 * - Timestamp.toDate()
 * - Firestore JSON: { _seconds, _nanoseconds }
 * - ISO strings or epoch-like values
 * Returns ISO string or null
 */
const toISO = (v: any) => {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") {
      const d = v.toDate();
      return d && !isNaN(d.getTime()) ? d.toISOString() : null;
    }
    if (typeof v === "object" && typeof v._seconds === "number") {
      const ms = v._seconds * 1000 + (typeof v._nanoseconds === "number" ? v._nanoseconds / 1e6 : 0);
      const d = new Date(ms);
      return !isNaN(d.getTime()) ? d.toISOString() : null;
    }
    const d = new Date(v);
    return !isNaN(d.getTime()) ? d.toISOString() : null;
  } catch {
    return null;
  }
};

// ISO week key, Mon-based (YYYY-Www); we also keep the last date for chart label spacing
function toWeekKeyKeepLast(ymd: string) {
  const d = new Date(ymd + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // 0..6 (Mon..Sun)
  const thursday = addDays(d, 3 - day);
  const year = thursday.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const week = Math.round((+thursday - +oneJan) / (7 * 24 * 3600 * 1000)) + 1;
  const ww = String(week).padStart(2, "0");
  return { weekKey: `${year}-W${ww}`, lastDate: ymd };
}

// ---- Shapes ---------------------------------------------------------------
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
  completed_date?: string | { toDate?: () => Date } | { _seconds?: number; _nanoseconds?: number } | null;
  date_completed?: string | { toDate?: () => Date } | { _seconds?: number; _nanoseconds?: number } | null;
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

type CheckinRow = {
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  photo_url?: string | null;
};
type CheckinsSeriesResp = { results: CheckinRow[] };

// ---- Page -----------------------------------------------------------------
export default function ProgressPage() {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const email = session?.user?.email || null;

  // -------- All‑time completions (paged) -----------------------------------
  // We page all completions to compute all-time KPIs and weekly charts.
  const PAGE_LIMIT = 500;
  const getKey = (pageIndex: number, previousPageData: CompletionsIndexResp | null) => {
    if (!mounted || !email) return null;
    if (previousPageData && !previousPageData.nextCursor) return null; // end
    const params = new URLSearchParams();
    params.set("user_email", email);
    params.set("limit", String(PAGE_LIMIT));
    if (pageIndex > 0 && previousPageData?.nextCursor) {
      params.set("cursor", previousPageData.nextCursor);
    }
    // NOTE: unified route is /api/completions (NOT /api/completions/index)
    return `/api/completions?${params.toString()}`;
  };

  const {
    data: pages,
    error: compsErr,
    isValidating: compsLoading,
  } = useSWRInfinite<CompletionsIndexResp>(getKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const allCompletions: Completion[] = useMemo(() => {
    const flatten: Completion[] = [];
    for (const p of pages || []) {
      const src = p?.results || p?.items || p?.completions || p?.data || [];
      if (Array.isArray(src)) flatten.push(...src);
    }
    return flatten;
  }, [pages]);

  // -------- Check‑ins series (show all) ------------------------------------
  // Pull a large window to approximate "all checks" (change 1000 if you need more).
  const checkinsKey =
    mounted && email
      ? `/api/checkins/series?email=${encodeURIComponent(email)}&limit=1000`
      : null;

  const { data: checkins, error: checkinsErr } = useSWR<CheckinsSeriesResp>(checkinsKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    shouldRetryOnError: false,
  });

  // -------- Aggregate all‑time KPIs + weekly series ------------------------
  const {
    allTimeSessions,
    allTimeCalories,
    currentStreak,
    maxStreak,
    weeklyCaloriesAsc,
    weeklySessionsAsc,
    topLoads,
  } = useMemo(() => {
    const daySet = new Set<string>();
    const weeklyMap = new Map<
      string,
      { calories: number; sessions: number; lastDate: string }
    >();
    const loads: { weight_kg: number; when: string }[] = [];

    let totalCalories = 0;
    let totalSessions = 0;

    for (const c of allCompletions) {
      // IMPORTANT: include date_completed fallback (and keep started_at/created_at as last resort)
      const iso =
        toISO((c as any).completed_date) ||
        toISO((c as any).date_completed) ||
        toISO((c as any).started_at) ||
        toISO((c as any).created_at);

      if (!iso) continue;

      const ymd = iso.slice(0, 10);
      daySet.add(ymd);
      totalSessions += 1;

      const cal = Number(c.calories_burned) || 0;
      totalCalories += cal;

      const { weekKey, lastDate } = toWeekKeyKeepLast(ymd);
      const wk = weeklyMap.get(weekKey) || { calories: 0, sessions: 0, lastDate };
      wk.calories += cal;
      wk.sessions += 1;
      if (ymd > wk.lastDate) wk.lastDate = ymd;
      weeklyMap.set(weekKey, wk);

      // Heaviest loads (aggregate + benchmark parts)
      const aggW = Number(c.weight_completed_with);
      if (Number.isFinite(aggW) && aggW > 0) loads.push({ weight_kg: aggW, when: iso });
      if (c.benchmark_metrics && typeof c.benchmark_metrics === "object") {
        for (const [, part] of Object.entries(c.benchmark_metrics)) {
          const w = Number((part as any)?.weight_kg);
          if (Number.isFinite(w) && w > 0) loads.push({ weight_kg: w, when: iso });
        }
      }
    }

    // Current streak up to today (consecutive days with >=1 completion)
    const today = new Date();
    let currentStreak = 0;
    for (let i = 0; i < 3650; i++) {
      const d = addDays(new Date(today), -i);
      const k = fmtYMD(d);
      if (daySet.has(k)) currentStreak++;
      else break;
    }

    // Max streak across history
    const sortedDays = Array.from(daySet).sort((a, b) => a.localeCompare(b));
    let maxStreak = 0;
    let run = 0;
    let prev: string | null = null;
    for (const k of sortedDays) {
      if (!prev) {
        run = 1;
        prev = k;
        maxStreak = Math.max(maxStreak, run);
        continue;
      }
      const prevDate = new Date(prev);
      const thisDate = new Date(k);
      const diffDays = Math.round((+thisDate - +prevDate) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        run++;
      } else {
        run = 1;
      }
      prev = k;
      maxStreak = Math.max(maxStreak, run);
    }

    // Weekly ascending arrays for charts
    const weeklyAsc = Array.from(weeklyMap.entries())
      .map(([wk, v]) => ({ weekKey: wk, lastDate: v.lastDate, calories: v.calories, sessions: v.sessions }))
      .sort((a, b) => a.lastDate.localeCompare(b.lastDate));

    const weeklyCaloriesAsc = weeklyAsc.map((r) => ({ dateKey: r.lastDate, value: r.calories }));
    const weeklySessionsAsc = weeklyAsc.map((r) => ({ dateKey: r.lastDate, value: r.sessions }));

    const topLoads = loads.sort((a, b) => b.weight_kg - a.weight_kg).slice(0, 5);

    return {
      allTimeSessions: totalSessions,
      allTimeCalories: totalCalories,
      currentStreak,
      maxStreak,
      weeklyCaloriesAsc,
      weeklySessionsAsc,
      topLoads,
    };
  }, [allCompletions]);

  // -------- Weight/Body Fat charts (end at last check‑in) ------------------
  const weightChart = useMemo(() => {
    if (checkinsErr) return null;
    const src = (checkins?.results || []).slice().reverse(); // ascending to last check‑in
    const labels = src.map((r) =>
      new Date(r.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    );
    const data = src.map((r) => (typeof r.weight_kg === "number" ? r.weight_kg : null));

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
  }, [checkins, checkinsErr]);

  const bodyFatChart = useMemo(() => {
    if (checkinsErr) return null;
    const src = (checkins?.results || []).slice().reverse();
    const labels = src.map((r) =>
      new Date(r.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    );
    const data = src.map((r) => (typeof r.body_fat_pct === "number" ? r.body_fat_pct : null));

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
  }, [checkins, checkinsErr]);

  // -------- Weekly charts (same size as the above) -------------------------
  const weeklyCaloriesChart = useMemo(() => {
    const labels = weeklyCaloriesAsc.map((r) =>
      new Date(r.dateKey).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    );
    const data = weeklyCaloriesAsc.map((r) => r.value);
    const chartData: ChartData<"line"> = {
      labels,
      datasets: [
        {
          label: "Calories burned (per week)",
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
  }, [weeklyCaloriesAsc]);

  const weeklySessionsChart = useMemo(() => {
    const labels = weeklySessionsAsc.map((r) =>
      new Date(r.dateKey).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    );
    const data = weeklySessionsAsc.map((r) => r.value);
    const chartData: ChartData<"line"> = {
      labels,
      datasets: [
        {
          label: "Sessions completed (per week)",
          data,
          borderColor: "#32ff7f",
          backgroundColor: "rgba(50,255,127,0.25)",
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
  }, [weeklySessionsAsc]);

  return (
    <>
      <Head>
        <title>Progress • BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="mobile-web-app-capable" content="yes" />
      </Head>

      <main
        className="container py-3"
        style={{ paddingBottom: 90, color: "#fff", borderRadius: 12, minHeight: "100vh" }}
      >
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h1 className="h4 mb-0" style={{ fontWeight: 700 }}>
              Progress
            </h1>
            <small className="text-dim">Trends, check‑ins, and recent lifts</small>
          </div>
          <div className="d-flex gap-2">
            <Link href="/checkin" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
              Add check‑in
            </Link>
            <a
              href="https://bkxr-app.vercel.app/schedule"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm"
              style={{
                borderRadius: 24,
                color: "#fff",
                background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                boxShadow: `0 0 14px ${ACCENT}66`,
              }}
            >
              Book a class
            </a>
          </div>
        </div>

        {/* KPIs (all‑time) */}
        <section className="row gx-3">
          <div className="col-6 col-md-3 mb-3">
            <div className="futuristic-card p-3">
              <div className="small text-dim">Sessions (all time)</div>
              <div className="h4 m-0">{allTimeSessions}</div>
            </div>
          </div>
          <div className="col-6 col-md-3 mb-3">
            <div className="futuristic-card p-3">
              <div className="small text-dim">Calories (all time)</div>
              <div className="h4 m-0">{allTimeCalories}</div>
            </div>
          </div>
          <div className="col-6 col-md-3 mb-3">
            <div className="futuristic-card p-3">
              <div className="small text-dim">Current streak</div>
              <div className="h4 m-0">{currentStreak} days</div>
            </div>
          </div>
          <div className="col-6 col-md-3 mb-3">
            <div className="futuristic-card p-3">
              <div className="small text-dim">Max streak</div>
              <div className="h4 m-0">{maxStreak} days</div>
            </div>
          </div>
        </section>

        {/* Charts (two rows; all same size) */}
        <section className="row gx-3">
          {/* Row 1: Weight / Body fat (end at last check‑in) */}
          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-3">
              <h6 className="mb-2" style={{ fontWeight: 700 }}>
                Weight
              </h6>
              {checkinsErr ? (
                <div className="text-dim">No check‑ins yet.</div>
              ) : weightChart ? (
                <Line data={weightChart.chartData} options={weightChart.options} />
              ) : (
                <div className="text-dim">No check‑ins yet.</div>
              )}
            </div>
          </div>

          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-3">
              <h6 className="mb-2" style={{ fontWeight: 700 }}>
                Body fat
              </h6>
              {checkinsErr ? (
                <div className="text-dim">No check‑ins yet.</div>
              ) : bodyFatChart ? (
                <Line data={bodyFatChart.chartData} options={bodyFatChart.options} />
              ) : (
                <div className="text-dim">No check‑ins yet.</div>
              )}
            </div>
          </div>

          {/* Row 2: Calories/week / Sessions/week (same size as above) */}
          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-3">
              <h6 className="mb-2" style={{ fontWeight: 700 }}>
                Calories burned (per week)
              </h6>
              <Line
                data={weeklyCaloriesChart.chartData}
                options={weeklyCaloriesChart.options}
              />
              {compsLoading && (
                <div className="small text-dim mt-1">Loading all-time history…</div>
              )}
              {compsErr && (
                <div className="small text-danger mt-1">
                  Unable to load all-time data.
                </div>
              )}
            </div>
          </div>

          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-3">
              <h6 className="mb-2" style={{ fontWeight: 700 }}>
                Sessions completed (per week)
              </h6>
              <Line
                data={weeklySessionsChart.chartData}
                options={weeklySessionsChart.options}
              />
            </div>
          </div>
        </section>

        {/* Recent kettlebell loads */}
        <section className="row gx-3">
          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-3">
              <h6 className="mb-2" style={{ fontWeight: 700 }}>
                Recent loads (heaviest)
              </h6>
              {topLoads.length ? (
                <ul className="m-0" style={{ paddingLeft: 18 }}>
                  {topLoads.map((l, i) => (
                    <li key={`${l.when}-${i}`} className="mb-1">
                      <span className="fw-semibold">{l.weight_kg} kg</span>
                      <span className="text-dim">
                        {" "}
                        •{" "}
                        {new Date(l.when).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-dim">No loads recorded yet.</div>
              )}
            </div>
          </div>

          {/* All Check-ins list with per-day Edit links */}
          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-3">
              <div className="d-flex align-items-center justify-content-between">
                <h6 className="mb-2" style={{ fontWeight: 700 }}>
                  Check‑ins
                </h6>
                <Link
                  href="/checkin"
                  className="btn btn-bxkr-outline btn-sm"
                  style={{ borderRadius: 24 }}
                >
                  Add
                </Link>
              </div>

              {checkinsErr ? (
                <div className="text-dim">No check‑ins yet.</div>
              ) : (checkins?.results || []).length ? (
                <div
                  style={{
                    maxHeight: 360,
                    overflowY: "auto",
                    paddingRight: 4,
                  }}
                >
                  {(checkins?.results || []).map((c, idx) => {
                    const date = new Date(c.date);
                    const ymd = date.toISOString().slice(0, 10); // link to specific day
                    return (
                      <div
                        key={`${ymd}-${idx}`}
                        className="d-flex align-items-center justify-content-between mb-2"
                      >
                        <div>
                          <div className="small text-dim">
                            {date.toLocaleDateString(undefined, {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                          <div className="fw-semibold">
                            {typeof c.weight_kg === "number" ? `${c.weight_kg} kg` : "—"} ·{" "}
                            {typeof c.body_fat_pct === "number"
                              ? `${c.body_fat_pct}%`
                              : "—"}
                          </div>
                        </div>
                        <div className="d-flex gap-2">
                          <Link
                            href={`/checkin?date=${encodeURIComponent(ymd)}`}
                            className="btn btn-sm btn-bxkr-outline"
                            style={{ borderRadius: 24 }}
                            aria-label={`Edit check-in ${ymd}`}
                          >
                            Edit
                          </Link>
                          {c.photo_url ? (
                            <a
                              href={c.photo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-sm"
                              style={{
                                borderRadius: 24,
                                color: "#fff",
                                background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                                boxShadow: `0 0 14px ${ACCENT}66`,
                              }}
                              aria-label="Open photo"
                            >
                              Photo
                            </a>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-dim">No check‑ins yet.</div>
              )}
            </div>
          </div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}
