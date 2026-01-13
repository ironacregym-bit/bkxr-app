
"use client";

import Head from "next/head";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import BottomNav from "../components/BottomNav";

// Charts
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

// Register chart elements once
ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

const fetcher = (u: string) => fetch(u).then((r) => r.json());

// ---- Brand ------------------------------------------------------------------
const ACCENT = "#FF8A2A";

// ---- Small date helpers -----------------------------------------------------
function formatDateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function subDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - days);
  return x;
}

// ---- Page -------------------------------------------------------------------
export default function WorkoutHubPage() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email || null;

  // Prefer: /api/completions/history?email=&limit=5
  // Fallback: /api/completions/index?user_email&from&to (last 90 days)
  const todayKey = formatDateKeyLocal(new Date());
  const fromKey = formatDateKeyLocal(subDays(new Date(), 90));

  const historyUrl = userEmail
    ? `/api/completions/history?email=${encodeURIComponent(userEmail)}&limit=5`
    : null;

  // try history first
  const { data: histPrimary, error: histPrimaryErr } = useSWR(historyUrl, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
  });

  // if history endpoint missing, try index range
  const useFallback = !!histPrimaryErr;
  const historyRangeUrl =
    userEmail && useFallback
      ? `/api/completions/index?user_email=${encodeURIComponent(
          userEmail
        )}&from=${encodeURIComponent(fromKey)}&to=${encodeURIComponent(todayKey)}`
      : null;

  const { data: histFallback } = useSWR(useFallback ? historyRangeUrl : null, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
  });

  // Normalise whatever shape we get back
  const historyPreview = useMemo(() => {
    const src =
      histPrimary?.results ||
      histPrimary?.items ||
      histPrimary?.completions ||
      histPrimary?.data ||
      histFallback?.results ||
      histFallback?.items ||
      histFallback?.completions ||
      histFallback?.data ||
      [];

    const arr = Array.isArray(src) ? src : [];
    const mapped = arr
      .map((c: any) => ({
        completed_date:
          c.completed_date?.toDate?.() instanceof Date
            ? c.completed_date.toDate()
            : c.completed_date
            ? new Date(c.completed_date)
            : null,
        calories_burned: Number(c.calories_burned || 0),
        sets_completed: Number(c.sets_completed || 0),
        weight_completed_with: c.weight_completed_with ?? null,
        // Try to read a workout name without changing schema
        workout_name:
          c.workout_name ??
          c.name ??
          c.title ??
          c.workout?.name ??
          c.workout_title ??
          c.plan_name ??
          null,
      }))
      .filter((c: any) => !!c.completed_date)
      .sort(
        (a: any, b: any) =>
          (b.completed_date as Date).getTime() - (a.completed_date as Date).getTime()
      )
      .slice(0, 5);

    return mapped;
  }, [histPrimary, histFallback]);

  return (
    <>
      <Head>
        <title>Train • BXKR</title>
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
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <h1 className="h4 mb-0" style={{ fontWeight: 700 }}>
                Train
              </h1>
              <small style={{ opacity: 0.75 }}>Build momentum today</small>
            </div>
          </div>

          {/* Today’s Workout + Freestyle CTA (UI-only; soft-fail) */}
          <TodaysWorkoutHeader email={userEmail} />
        </div>

        {/* Tiles */}
        <section className="row gx-3">
          {/* Workout History */}
          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-3" style={{ height: "100%" }}>
              <h6 className="mb-3" style={{ fontWeight: 700 }}>
                Workout History
              </h6>

              {historyPreview.length ? (
                historyPreview.map((c: any, idx: number) => {
                  const dateText = new Date(c.completed_date).toLocaleDateString(
                    undefined,
                    { day: "numeric", month: "short" }
                  );
                  const nameText = c.workout_name || "Workout";
                  return (
                    <div key={idx} className="mb-2 d-flex justify-content-between">
                      <div>
                        <div className="fw-semibold">
                          {nameText} <span className="text-dim">— {dateText}</span>
                        </div>
                        <div>
                          {Math.round(c.calories_burned || 0)} kcal · {c.sets_completed || 0} sets
                        </div>
                        {c.weight_completed_with != null && (
                          <div className="small text-dim">Weight used: {c.weight_completed_with}</div>
                        )}
                      </div>
                      <Link
                        href="/history"
                        className="btn btn-link text-dim"
                        aria-label={`View details for ${nameText}`}
                      >
                        <i className="fas fa-chevron-right" />
                      </Link>
                    </div>
                  );
                })
              ) : histPrimaryErr ? (
                <div className="text-muted">Couldn’t load history</div>
              ) : (
                <div className="text-muted">No history yet</div>
              )}

              <Link href="/history" className="btn btn-outline-light btn-sm mt-2" style={{ borderRadius: 24 }}>
                View More
              </Link>
            </div>
          </div>

          {/* Benchmarks + Graphs */}
          <div className="col-12 col-md-6 mb-3">
            <div className="futuristic-card p-3" style={{ height: "100%" }}>
              <h6 className="mb-3" style={{ fontWeight: 700 }}>
                Benchmarks
              </h6>

              <BenchmarksList email={userEmail} />

              <div className="mt-3">
                <BenchmarkGraphs email={userEmail} />
              </div>
            </div>
          </div>
        </section>

        {/* Exercise Library with filters */}
        <ExerciseLibrary />
      </main>

      <BottomNav />
    </>
  );
}

// ---- Header: Today’s Workout (UI-only; soft-fail) ----------------------------
function TodaysWorkoutHeader({ email }: { email?: string | null }) {
  // Try planned online workout for today
  const { data: planned, error: plannedErr } = useSWR(
    email ? `/api/workouts/planned/today?email=${encodeURIComponent(email)}` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30_000 }
  );

  // Try booked gym class for today
  const { data: booked, error: bookedErr } = useSWR(
    email ? `/api/classes/today?email=${encodeURIComponent(email)}` : null,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false, dedupingInterval: 30_000 }
  );

  // Pick the best available source (no schema changes)
  const plannedItem =
    planned?.result || planned?.item || planned?.workout || planned?.today || planned?.data || null;
  const bookedItem =
    booked?.result || booked?.item || booked?.class || booked?.today || booked?.data || null;

  const item = plannedItem || bookedItem || null;

  // Render
  if (plannedErr && bookedErr) {
    return (
      <div className="futuristic-card p-3 mt-2">
        <div className="d-flex align-items-center justify-content-between">
          <div>
            <div className="fw-semibold">Planned today</div>
            <div className="small text-dim">Unable to load today’s plan. You can still browse or start a freestyle session.</div>
          </div>
          <div className="d-flex gap-2">
            <Link
              href="/workouts"
              className="btn btn-sm"
              style={{
                borderRadius: 24,
                color: "#fff",
                background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                boxShadow: `0 0 14px ${ACCENT}66`,
              }}
            >
              Browse Workouts
            </Link>
            <Link href="/workouts/new?mode=freestyle" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
              Start a freestyle session
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="futuristic-card p-3 mt-2">
        <div className="d-flex align-items-center justify-content-between">
          <div>
            <div className="fw-semibold">No plan today</div>
            <div className="small text-dim">It’s a good day for Upper Body — try “Heavy Bag Intervals”.</div>
          </div>
          <div className="d-flex gap-2">
            <Link
              href="/workouts"
              className="btn btn-sm"
              style={{
                borderRadius: 24,
                color: "#fff",
                background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                boxShadow: `0 0 14px ${ACCENT}66`,
              }}
            >
              Browse Workouts
            </Link>
            <Link href="/workouts/new?mode=freestyle" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
              Start a freestyle session
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Derive display fields safely
  const name =
    item.name || item.title || item.workout_name || item.class_name || item.plan_name || "Workout";
  const time =
    item.time ||
    item.start_time ||
    item.start ||
    item.starts_at ||
    item.session_time ||
    null;
  const gym =
    item.gym_name || item.location || item.gym || item.venue || null;

  return (
    <div className="futuristic-card p-3 mt-2">
      <div className="d-flex align-items-center justify-content-between">
        <div className="me-2">
          <div className="fw-semibold">
            {name}
            {time ? <span className="text-dim"> • {String(time)}</span> : null}
          </div>
          {gym ? <div className="small text-dim">Booked at {gym}</div> : <div className="small text-dim">Planned today</div>}
        </div>
        <div className="d-flex gap-2">
          {gym ? (
            <Link href="/classes/today" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
              Check in
            </Link>
          ) : null}
          <Link
            href="/workouts/start/today"
            className="btn btn-sm"
            style={{
              borderRadius: 24,
              color: "#fff",
              background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
              boxShadow: `0 0 14px ${ACCENT}66`,
            }}
          >
            Start
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---- Benchmarks (list, soft‑fail if API missing) ----------------------------
function BenchmarksList({ email }: { email?: string | null }) {
  const { data, error } = useSWR(
    email ? `/api/benchmarks/latest?email=${encodeURIComponent(email)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30_000,
    }
  );

  const has = Array.isArray(data?.results) && data.results.length > 0;

  if (error) return <div className="text-muted">Can’t load benchmarks</div>;
  if (!has) return <div className="text-muted">No benchmarks yet</div>;

  return (
    <div>
      {data.results.slice(0, 3).map((r: any, i: number) => (
        <div key={i} className="mb-2">
          <div className="fw-semibold">{r.name}</div>
          <div className="small text-dim">
            {r.value} {r.unit} · {r.date ? new Date(r.date).toLocaleDateString() : ""}
          </div>
        </div>
      ))}
      <div className="mt-2 d-flex gap-2">
        <Link href="/benchmarks" className="btn btn-outline-light btn-sm" style={{ borderRadius: 24 }}>
          View
        </Link>
        <Link
          href="/benchmarks/new"
          className="btn btn-sm"
          style={{
            borderRadius: 24,
            color: "#fff",
            background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
            boxShadow: `0 0 14px ${ACCENT}88`,
          }}
        >
          Add Result
        </Link>
      </div>
    </div>
  );
}

// ---- Benchmark Graphs (weight & sets per kettlebell part) -------------------
function BenchmarkGraphs({ email }: { email?: string | null }) {
  // Expected endpoint: /api/benchmarks/series?email=...
  // Shape expectation (flexible):
  // [{ part: "Kettlebell Swing", date: "...", weight: 24, sets: 5 }, ...]
  const { data, error } = useSWR(
    email ? `/api/benchmarks/series?email=${encodeURIComponent(email)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  // Soft-fail messaging if endpoint not present
  if (error) {
    return (
      <div className="text-muted">
        Benchmark history unavailable. Add <code>/api/benchmarks/series</code> to see graphs.
      </div>
    );
  }
  const series: any[] = Array.isArray(data?.results || data?.items || data?.series)
    ? (data.results || data.items || data.series)
    : [];
  if (series.length === 0) {
    return <div className="text-muted">No benchmark history yet.</div>;
  }

  // Group by kettlebell part (or exercise name fallback)
  const groups: Record<string, any[]> = {};
  for (const row of series) {
    const key =
      row.part ||
      row.kb_part ||
      row.exercise_part ||
      row.exercise_name ||
      row.name ||
      "Unknown Part";
    (groups[key] ??= []).push(row);
  }

  return (
    <div>
      {Object.entries(groups).map(([part, rows]) => {
        // sort by date ascending for a clean line
        const sorted = rows
          .map((r) => ({
            date:
              r.date?.toDate?.() instanceof Date
                ? r.date.toDate()
                : r.date
                ? new Date(r.date)
                : null,
            weight:
              r.weight != null
                ? Number(r.weight)
                : r.value_unit === "kg"
                ? Number(r.value)
                : null,
            sets:
              r.sets != null
                ? Number(r.sets)
                : r.sets_completed != null
                ? Number(r.sets_completed)
                : null,
          }))
          .filter((r) => !!r.date)
          .sort((a, b) => (a.date as Date).getTime() - (b.date as Date).getTime());

        if (sorted.length === 0) return null;

        const labels = sorted.map((r) =>
          (r.date as Date).toLocaleDateString(undefined, { day: "numeric", month: "short" })
        );
        const weightData = sorted.map((r) => (r.weight != null ? r.weight : 0));
        const setsData = sorted.map((r) => (r.sets != null ? r.sets : 0));

        const dataCfg = {
          labels,
          datasets: [
            {
              label: "Weight (kg)",
              data: weightData,
              borderColor: "#FF8A2A",
              backgroundColor: "rgba(255,138,42,0.2)",
              tension: 0.3,
              pointRadius: 3,
            },
            {
              label: "Sets",
              data: setsData,
              borderColor: "#32ff7f",
              backgroundColor: "rgba(50,255,127,0.2)",
              tension: 0.3,
              pointRadius: 3,
              yAxisID: "y1",
            },
          ],
        };
        const options = {
          responsive: true,
          plugins: {
            legend: { labels: { color: "#e9eef6" } },
            tooltip: { mode: "index" as const, intersect: false },
          },
          scales: {
            x: {
              ticks: { color: "#9fb0c3" },
              grid: { color: "rgba(255,255,255,0.08)" },
            },
            y: {
              ticks: { color: "#9fb0c3" },
              grid: { color: "rgba(255,255,255,0.08)" },
            },
            y1: {
              position: "right" as const,
              ticks: { color: "#9fb0c3" },
              grid: { drawOnChartArea: false },
            },
          },
        };

        return (
          <div key={part} className="mb-3">
            <div className="fw-semibold mb-1">{part}</div>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 8 }}>
              <Line data={dataCfg} options={options} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Exercise Library with filters -----------------------------------------
function ExerciseLibrary() {
  // Tabs used to filter Types per your schema (no schema changes)
  const TYPES = ["All", "Boxing", "Kettlebell", "Warm up", "Mobility", "Weights", "Bodyweight"] as const;
  const [activeType, setActiveType] = useState<(typeof TYPES)[number]>("All");

  const url =
    activeType === "All"
      ? "/api/exercises"
      : `/api/exercises?type=${encodeURIComponent(activeType)}`;

  const { data, error, isLoading } = useSWR(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const items = Array.isArray(data?.results || data?.items || data?.exercises)
    ? (data.results || data.items || data.exercises)
    : [];

  return (
    <section className="futuristic-card p-3" style={{ marginTop: 4 }}>
      <div className="d-flex justify-content-between align-items-center">
        <h6 className="m-0" style={{ fontWeight: 700 }}>
          Exercise Library
        </h6>
        <Link href="/exercises" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
          Browse
        </Link>
      </div>

      {/* Filter chips */}
      <div className="d-flex flex-wrap gap-2 mt-3">
        {TYPES.map((t) => (
          <button
            key={t}
            className="bxkr-chip"
            onClick={() => setActiveType(t)}
            style={{
              borderColor: activeType === t ? ACCENT : "rgba(255,255,255,0.12)",
              color: activeType === t ? ACCENT : "#e9eef6",
            }}
            aria-pressed={activeType === t}
          >
            {t}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="mt-3">
        {isLoading && <div className="text-muted">Loading exercises…</div>}
        {error && <div className="text-danger">Failed to load exercises.</div>}
        {!isLoading && !error && items.length === 0 && (
          <div className="text-muted">No exercises found for {activeType}.</div>
        )}

        {items.slice(0, 6).map((ex: any) => {
          const exId = ex.id ?? ex.exercise_id ?? ex.Name;
          const exName = ex.name ?? ex.Name ?? "Exercise";
          const exType = ex.type ?? ex.Type ?? "Uncategorised";
          return (
            <Link
              key={exId}
              href={`/exercises/${encodeURIComponent(exId)}`}
              className="text-decoration-none"
              style={{ color: "inherit" }}
              aria-label={`Open ${exName}`}
            >
              <div className="futuristic-card p-3 mb-2 d-flex align-items-center justify-content-between">
                <div>
                  <div className="fw-semibold">{exName}</div>
                  <div className="small text-dim">{exType}</div>
                </div>
                <i className="fas fa-chevron-right text-dim" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
