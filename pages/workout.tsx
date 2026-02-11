"use client";

import Head from "next/head";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useMemo } from "react";
import BottomNav from "../components/BottomNav";
import ExerciseLibrary from "../components/train/ExerciseLibrary";

// Charts
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
function startOfWeekMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 Sun - 6 Sat
  const diff = (day + 6) % 7; // days since Monday
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - diff);
  return date;
}
function endOfWeekSunday(d: Date): Date {
  const sow = startOfWeekMonday(d);
  const eow = new Date(sow);
  eow.setDate(sow.getDate() + 6);
  eow.setHours(23, 59, 59, 999);
  return eow;
}
function toDateSafe(v: any): Date | null {
  if (!v) return null;
  if (v?.toDate && typeof v.toDate === "function") {
    const d = v.toDate();
    return d instanceof Date ? d : null;
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function dayLabel(d: Date | null): string {
  if (!d) return "Any day";
  return d.toLocaleDateString(undefined, { weekday: "short" });
}
function dayIndexMonSun(d: Date | null): number {
  if (!d) return 7; // unknown at bottom
  const js = d.getDay(); // Sun=0..Sat=6
  return js === 0 ? 6 : js - 1; // Mon=0..Sun=6
}

// ---- Page -------------------------------------------------------------------
export default function WorkoutHubPage() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email || null;

  // Completions history: primary then fallback
  const todayKey = formatDateKeyLocal(new Date());
  const fromKey = formatDateKeyLocal(subDays(new Date(), 90));

  const historyUrl = userEmail
    ? `/api/completions/history?email=${encodeURIComponent(userEmail)}&limit=5`
    : null;

  const { data: histPrimary, error: histPrimaryErr } = useSWR(historyUrl, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
  });

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

          {/* Weekly workouts (mandatory + optional) */}
          <WeeklyWorkoutsHeader email={userEmail} />
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
                  const dateText = new Date(c.completed_date).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  });
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

              <Link
                href="/history"
                className="btn btn-outline-light btn-sm mt-2"
                style={{ borderRadius: 24 }}
              >
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

        {/* Exercise Library with filters (external component) */}
        <ExerciseLibrary />
      </main>

      <BottomNav />
    </>
  );
}

// ---- Weekly Workouts (Mandatory & Optional) ---------------------------------
type WeeklyResp = {
  weekStart?: string | Date | any;
  workouts?: any[];
  items?: any[];
  results?: any[];
  data?: any[];
};

type WeekCard = {
  id: string;
  name: string;
  kind: "gym" | "bxkr" | "unknown";
  date: Date | null;
  isOptional: boolean;
  href: string;
};

function inferKind(data: any): "gym" | "bxkr" | "unknown" {
  const fromList = String(data?.kind || "").toLowerCase();
  if (fromList === "gym" || fromList === "bxkr") return fromList as "gym" | "bxkr";
  const wt = String(data?.workout_type || "").toLowerCase();
  if (wt === "gym_custom") return "gym";
  if (wt) return "bxkr";
  return "unknown";
}

function WeeklyWorkoutsHeader({ email }: { email?: string | null }) {
  // Primary source: /api/workouts → { weekStart, workouts: [] }
  const key = email ? "/api/workouts" : null;
  const { data, error } = useSWR<WeeklyResp>(key, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60_000,
    shouldRetryOnError: false,
  });

  const { mandatory, optional, sow, eow } = useMemo(() => {
    const list =
      (Array.isArray(data?.workouts) && data!.workouts) ||
      (Array.isArray(data?.results) && data!.results) ||
      (Array.isArray(data?.items) && data!.items) ||
      (Array.isArray(data?.data) && data!.data) ||
      [];

    const weekStart =
      toDateSafe(data?.weekStart) ??
      startOfWeekMonday(new Date()); // if API omits weekStart, assume current week

    const weekEnd = endOfWeekSunday(weekStart);

    const rows: WeekCard[] = list
      .map((w: any): WeekCard | null => {
        const id: string =
          w.id ?? w.workout_id ?? w.workoutId ?? w.slug ?? w.doc_id ?? String(w._id || "");
        if (!id) return null;

        const name: string = w.name ?? w.workout_name ?? w.title ?? w.plan_name ?? "Workout";
        const kind = inferKind(w);

        // Try to read a scheduled date within the week
        const dateField =
          w.date ??
          w.scheduled_for ??
          w.scheduled_at ??
          w.due_date ??
          w.day_date ??
          w.start ??
          w.starts_at ??
          w.session_date ??
          w.when ??
          null;
        const date = toDateSafe(dateField);

        // Optional flag (default to mandatory)
        const isOptional: boolean =
          (typeof w.optional === "boolean" && w.optional) ||
          (typeof w.is_optional === "boolean" && w.is_optional) ||
          (typeof w.mandatory === "boolean" ? !w.mandatory : false) ||
          (typeof w.required === "boolean" ? !w.required : false) ||
          false;

        // Build viewer href (match Admin page logic)
        const href =
          kind === "gym"
            ? `/gymworkout/${encodeURIComponent(id)}${
                date ? `?date=${encodeURIComponent(date.toISOString().slice(0, 10))}` : ""
              }`
            : `/workout/${encodeURIComponent(id)}`; // bxkr or unknown → same viewer

        return { id, name, kind, date, isOptional, href };
      })
      .filter(Boolean) as WeekCard[];

    // Keep only items that fall within the Mon–Sun window if a date is present
    const inWindow = rows.filter((r) => {
      if (!r.date) return true; // allow "Any day" items
      return r.date.getTime() >= weekStart.getTime() && r.date.getTime() <= weekEnd.getTime();
    });

    // Sort by day index; "Any day" last
    inWindow.sort((a, b) => {
      const da = dayIndexMonSun(a.date);
      const db = dayIndexMonSun(b.date);
      if (da !== db) return da - db;
      return a.name.localeCompare(b.name);
    });

    const mandatory = inWindow.filter((r) => !r.isOptional);
    const optional = inWindow.filter((r) => r.isOptional);

    return { mandatory, optional, sow: weekStart, eow: weekEnd };
  }, [data]);

  // Render states
  if (error) {
    return (
      <div className="futuristic-card p-3 mt-2">
        <div className="d-flex align-items-center justify-content-between">
          <div>
            <div className="fw-semibold">This week</div>
            <div className="small text-dim">Couldn’t load your weekly workouts.</div>
          </div>
          <Link href="/workouts" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
            Browse
          </Link>
        </div>
      </div>
    );
  }

  const hasAny = (mandatory?.length || 0) + (optional?.length || 0) > 0;
  const rangeLabel =
    sow && eow
      ? `${sow.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${eow.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
      : "";

  return (
    <div className="futuristic-card p-3 mt-2">
      <div className="d-flex align-items-center justify-content-between">
        <div>
          <div className="fw-semibold">Your week</div>
          <div className="small text-dim">{rangeLabel}</div>
        </div>
        <div className="d-flex gap-2">
          <Link href="/workouts" className="btn btn-bxkr-outline btn-sm" style={{ borderRadius: 24 }}>
            Plan
          </Link>
          <Link
            href="/workouts/freestyle"
            className="btn btn-sm"
            style={{
              borderRadius: 24,
              color: "#fff",
              background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
              boxShadow: `0 0 14px ${ACCENT}66`,
            }}
          >
            Log freestyle
          </Link>
        </div>
      </div>

      {!hasAny ? (
        <div className="mt-2 text-muted">No workouts scheduled this week.</div>
      ) : (
        <div className="mt-2">
          {/* Mandatory */}
          {mandatory.length > 0 && (
            <div className="mb-2">
              <div className="small text-dim mb-1">Mandatory</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {mandatory.map((w, i) => (
                  <li key={`m-${w.id}-${i}`} className="mb-1">
                    <Link
                      href={w.href}
                      className="w-100 d-flex align-items-center justify-content-between"
                      style={{
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(255,255,255,0.04)",
                        color: "#fff",
                        borderRadius: 10,
                        padding: "10px 12px",
                        textDecoration: "none",
                      }}
                      aria-label={`Open ${w.name}`}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <span
                          className="badge"
                          title={w.date ? w.date.toLocaleDateString() : "Any day"}
                          style={{
                            border: "1px solid rgba(255,255,255,0.2)",
                            background: "transparent",
                            color: "#fff",
                          }}
                        >
                          {dayLabel(w.date)}
                        </span>
                        <div className="fw-semibold text-truncate" style={{ maxWidth: 220 }}>
                          {w.name}
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span
                          className="badge"
                          style={{
                            background: ACCENT,
                            color: "#0b0f14",
                          }}
                        >
                          {w.kind === "gym" ? "Gym" : w.kind === "bxkr" ? "BXKR" : "Workout"}
                        </span>
                        <i className="fas fa-chevron-right text-dim" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Optional */}
          {optional.length > 0 && (
            <div>
              <div className="small text-dim mb-1">Optional</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {optional.map((w, i) => (
                  <li key={`o-${w.id}-${i}`} className="mb-1">
                    <Link
                      href={w.href}
                      className="w-100 d-flex align-items-center justify-content-between"
                      style={{
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(255,255,255,0.04)",
                        color: "#fff",
                        borderRadius: 10,
                        padding: "10px 12px",
                        textDecoration: "none",
                      }}
                      aria-label={`Open ${w.name}`}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <span
                          className="badge"
                          title={w.date ? w.date.toLocaleDateString() : "Any day"}
                          style={{
                            border: "1px solid rgba(255,255,255,0.2)",
                            background: "transparent",
                            color: "#fff",
                          }}
                        >
                          {dayLabel(w.date)}
                        </span>
                        <div className="fw-semibold text-truncate" style={{ maxWidth: 220 }}>
                          {w.name}
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span
                          className="badge"
                          style={{
                            border: "1px solid rgba(255,255,255,0.2)",
                            background: "transparent",
                            color: "#fff",
                          }}
                        >
                          Optional
                        </span>
                        <span
                          className="badge"
                          style={{
                            background: ACCENT,
                            color: "#0b0f14",
                          }}
                        >
                          {w.kind === "gym" ? "Gym" : w.kind === "bxkr" ? "BXKR" : "Workout"}
                        </span>
                        <i className="fas fa-chevron-right text-dim" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
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
  const { data, error } = useSWR(
    email ? `/api/benchmarks/series?email=${encodeURIComponent(email)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

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

        // ---- Typed chart config ----
        const dataCfg: ChartData<"line"> = {
          labels,
          datasets: [
            {
              label: "Weight (kg)",
              data: weightData,
              borderColor: "#FF8A2A",
              backgroundColor: "rgba(255,138,42,0.2)",
              tension: 0.3,
              pointRadius: 3,
            } as ChartDataset<"line">,
            {
              label: "Sets",
              data: setsData,
              borderColor: "#32ff7f",
              backgroundColor: "rgba(50,255,127,0.2)",
              tension: 0.3,
              pointRadius: 3,
              yAxisID: "y1",
            } as ChartDataset<"line">,
          ],
        };

        const options: ChartOptions<"line"> = {
          responsive: true,
          plugins: {
            legend: { labels: { color: "#e9eef6" } },
            tooltip: { mode: "index", intersect: false },
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
              position: "right",
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
