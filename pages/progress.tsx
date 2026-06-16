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
  Filler,
  type ChartData,
  type ChartOptions,
  type ChartDataset,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler);

const fetcher = (u: string) =>
  fetch(u).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  });

type ScopeMode = "program" | "all";
type TimeRange = "7d" | "30d" | "90d";

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

type CompletionsResp = {
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

type CheckinsSeriesResp = {
  results: CheckinRow[];
};

type CurrentProgram = {
  assignment_id: string;
  program_id: string;
  program_name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  weeks: number;
  current_week: number | null;
  is_active_today: boolean;
} | null;

type HomeOverviewResponse = {
  currentProgram?: CurrentProgram;
};

type LiftKey = "squat" | "bench" | "deadlift" | "ohp";

type StrengthPoint = {
  date: string;
  value: number;
};

const LIFT_LABELS: Record<LiftKey, string> = {
  squat: "Squat",
  bench: "Bench",
  deadlift: "Deadlift",
  ohp: "OHP",
};

const LIFT_MATCHERS: Record<LiftKey, string[]> = {
  squat: ["squat", "back squat", "front squat"],
  bench: ["bench", "bench press"],
  deadlift: ["deadlift"],
  ohp: ["ohp", "overhead press", "strict press", "press"],
};

function formatYMD(d: Date) {
  return d.toLocaleDateString("en-CA");
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfAlignedWeek(d: Date) {
  const day = d.getDay();
  const diffToMon = (day + 6) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - diffToMon);
  s.setHours(0, 0, 0, 0);
  return s;
}

function fmtShortDate(ymd: string) {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function toISO(v: any) {
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
}

function getCompletionISO(c: Completion) {
  return (
    toISO((c as any).completed_date) ||
    toISO((c as any).date_completed) ||
    toISO((c as any).started_at) ||
    toISO((c as any).created_at)
  );
}

function rangeDaysToNumber(range: TimeRange) {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  return 90;
}

function clampPct(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getBenchmarkValue(part: any) {
  if (!part || typeof part !== "object") return null;

  const candidates = [
    part.one_rm,
    part.estimated_1rm,
    part.estimated1rm,
    part.rm_1,
    part.value,
    part.weight_kg,
    part.weight,
  ];

  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return null;
}

function normaliseName(value: string) {
  return String(value || "").trim().toLowerCase();
}

function inferLiftKey(name: string): LiftKey | null {
  const n = normaliseName(name);

  for (const [lift, matchers] of Object.entries(LIFT_MATCHERS) as [LiftKey, string[]][]) {
    if (matchers.some((m) => n.includes(m))) return lift;
  }

  return null;
}

function extractStrengthSeries(completions: Completion[], startYMD: string, endYMD: string) {
  const out: Record<LiftKey, StrengthPoint[]> = {
    squat: [],
    bench: [],
    deadlift: [],
    ohp: [],
  };

  for (const c of completions) {
    const iso = getCompletionISO(c);
    if (!iso) continue;
    const ymd = iso.slice(0, 10);
    if (ymd < startYMD || ymd > endYMD) continue;

    const metrics = c.benchmark_metrics;
    if (!metrics || typeof metrics !== "object") continue;

    for (const [name, part] of Object.entries(metrics)) {
      const lift = inferLiftKey(name);
      if (!lift) continue;

      const value = getBenchmarkValue(part);
      if (!value) continue;

      out[lift].push({
        date: ymd,
        value,
      });
    }
  }

  for (const lift of Object.keys(out) as LiftKey[]) {
    out[lift].sort((a, b) => a.date.localeCompare(b.date));
  }

  return out;
}

function getDateWindow(scope: ScopeMode, range: TimeRange, currentProgram: CurrentProgram) {
  const today = new Date();
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);

  const days = rangeDaysToNumber(range);
  const rangeStart = addDays(new Date(today), -(days - 1));
  rangeStart.setHours(0, 0, 0, 0);

  if (scope !== "program" || !currentProgram?.start_date) {
    return {
      start: rangeStart,
      end,
    };
  }

  const programStart = new Date(`${currentProgram.start_date}T00:00:00`);
  const computedStart = programStart > rangeStart ? programStart : rangeStart;

  let programEnd = end;
  if (currentProgram.end_date) {
    const endFromProgram = new Date(`${currentProgram.end_date}T23:59:59`);
    if (!isNaN(endFromProgram.getTime()) && endFromProgram < programEnd) {
      programEnd = endFromProgram;
    }
  }

  return {
    start: computedStart,
    end: programEnd,
  };
}

function LoadingCard({ title }: { title: string }) {
  return (
    <section className="ia-tile ia-tile-pad mb-3">
      <div className="d-flex align-items-center justify-content-between">
        <div className="ia-card-title-compact">{title}</div>
        <i className="fas fa-spinner fa-spin text-dim" />
      </div>
    </section>
  );
}

function MiniSpark({
  labels,
  values,
  accent = "#18ff9a",
}: {
  labels: string[];
  values: number[];
  accent?: string;
}) {
  if (!values.length) {
    return <div className="text-dim small">No data yet</div>;
  }

  const chartData: ChartData<"line"> = {
    labels,
    datasets: [
      {
        label: "1RM",
        data: values,
        borderColor: accent,
        backgroundColor: "rgba(24,255,154,0.08)",
        tension: 0.35,
        pointRadius: 0,
        fill: true,
      } as ChartDataset<"line">,
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        display: false,
      },
    },
    elements: {
      line: {
        borderWidth: 2,
      },
    },
  };

  return (
    <div className="ia-progress-spark">
      <Line data={chartData} options={options} />
    </div>
  );
}

export default function ProgressPage() {
  const { data: session, status } = useSession();

  const [mounted, setMounted] = useState(false);
  const [scope, setScope] = useState<ScopeMode>("program");
  const [range, setRange] = useState<TimeRange>("30d");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (status === "loading") return;

    if (!session && typeof window !== "undefined") {
      window.location.replace(`/register?callbackUrl=${encodeURIComponent("/progress")}`);
    }
  }, [mounted, session, status]);

  const email = String(session?.user?.email || "").trim().toLowerCase();
  const isAuthed = Boolean(email);

  const currentWeekStart = useMemo(() => formatYMD(startOfAlignedWeek(new Date())), []);

  const { data: homeOverview } = useSWR<HomeOverviewResponse>(
    mounted && isAuthed
      ? `/api/iron-acre/home-overview?week=${encodeURIComponent(currentWeekStart)}`
      : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  const currentProgram = homeOverview?.currentProgram || null;

  useEffect(() => {
    if (!currentProgram) {
      setScope("all");
    }
  }, [currentProgram]);

  const PAGE_LIMIT = 300;

  const getKey = (pageIndex: number, previousPageData: CompletionsResp | null) => {
    if (!mounted || !email) return null;
    if (previousPageData && !previousPageData.nextCursor) return null;

    const params = new URLSearchParams();
    params.set("user_email", email);
    params.set("limit", String(PAGE_LIMIT));

    if (pageIndex > 0 && previousPageData?.nextCursor) {
      params.set("cursor", previousPageData.nextCursor);
    }

    return `/api/completions?${params.toString()}`;
  };

  const { data: completionPages, error: completionsErr, isValidating: completionsLoading } =
    useSWRInfinite<CompletionsResp>(getKey, fetcher, {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    });

  const allCompletions = useMemo(() => {
    const flatten: Completion[] = [];
    for (const p of completionPages || []) {
      const src = p?.results || p?.items || p?.completions || p?.data || [];
      if (Array.isArray(src)) flatten.push(...src);
    }
    return flatten;
  }, [completionPages]);

  const { data: checkinsResp, error: checkinsErr } = useSWR<CheckinsSeriesResp>(
    mounted && email ? `/api/checkins/series?email=${encodeURIComponent(email)}&limit=1000` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
      shouldRetryOnError: false,
    }
  );

  const allCheckins = useMemo(() => {
    const rows = Array.isArray(checkinsResp?.results) ? checkinsResp.results.slice() : [];
    rows.sort((a, b) => a.date.localeCompare(b.date));
    return rows;
  }, [checkinsResp]);

  const { start, end } = useMemo(() => getDateWindow(scope, range, currentProgram), [scope, range, currentProgram]);
  const startYMD = formatYMD(start);
  const endYMD = formatYMD(end);

  const filteredCheckins = useMemo(() => {
    return allCheckins.filter((c) => c.date >= startYMD && c.date <= endYMD);
  }, [allCheckins, startYMD, endYMD]);

  const filteredCompletions = useMemo(() => {
    return allCompletions.filter((c) => {
      const iso = getCompletionISO(c);
      if (!iso) return false;
      const ymd = iso.slice(0, 10);
      return ymd >= startYMD && ymd <= endYMD;
    });
  }, [allCompletions, startYMD, endYMD]);

  const baselineForScope = useMemo(() => {
    if (scope === "program" && currentProgram?.start_date) {
      const programStart = currentProgram.start_date;
      const programEnd = currentProgram.end_date || "9999-12-31";
      return allCheckins.filter((c) => c.date >= programStart && c.date <= programEnd);
    }
    return allCheckins;
  }, [scope, currentProgram, allCheckins]);

  const firstWeight = baselineForScope.find((c) => typeof c.weight_kg === "number" && c.weight_kg !== null) || null;
  const latestWeight = [...filteredCheckins]
    .reverse()
    .find((c) => typeof c.weight_kg === "number" && c.weight_kg !== null) || null;

  const weightDeltaKg = useMemo(() => {
    if (!firstWeight?.weight_kg || !latestWeight?.weight_kg) return 0;
    return latestWeight.weight_kg - firstWeight.weight_kg;
  }, [firstWeight, latestWeight]);

  const weightDeltaPct = useMemo(() => {
    if (!firstWeight?.weight_kg || !latestWeight?.weight_kg) return 0;
    if (!firstWeight.weight_kg) return 0;
    return ((latestWeight.weight_kg - firstWeight.weight_kg) / firstWeight.weight_kg) * 100;
  }, [firstWeight, latestWeight]);

  const filteredCalories = useMemo(() => {
    return filteredCompletions.reduce((sum, c) => sum + Number(c.calories_burned || 0), 0);
  }, [filteredCompletions]);

  const filteredSessions = filteredCompletions.length;

  const allDaysSet = useMemo(() => {
    const set = new Set<string>();
    for (const c of allCompletions) {
      const iso = getCompletionISO(c);
      if (!iso) continue;
      set.add(iso.slice(0, 10));
    }
    return set;
  }, [allCompletions]);

  const currentStreak = useMemo(() => {
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 3650; i++) {
      const d = addDays(today, -i);
      const ymd = formatYMD(d);
      if (allDaysSet.has(ymd)) streak++;
      else break;
    }
    return streak;
  }, [allDaysSet]);

  const weightChart = useMemo(() => {
    const labels = filteredCheckins.map((r) =>
      new Date(`${r.date}T00:00:00`).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      })
    );

    const values = filteredCheckins.map((r) =>
      typeof r.weight_kg === "number" ? r.weight_kg : null
    );

    const chartData: ChartData<"line"> = {
      labels,
      datasets: [
        {
          label: "Weight (kg)",
          data: values as (number | null)[],
          borderColor: "#18ff9a",
          backgroundColor: "rgba(24,255,154,0.14)",
          tension: 0.35,
          pointRadius: 0,
          fill: true,
        } as ChartDataset<"line">,
      ],
    };

    const options: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: { color: "#9fb0c3" },
          grid: { color: "rgba(255,255,255,0.06)" },
        },
        y: {
          ticks: { color: "#9fb0c3" },
          grid: { color: "rgba(255,255,255,0.06)" },
        },
      },
      elements: {
        line: {
          borderWidth: 2.5,
        },
      },
    };

    return { chartData, options };
  }, [filteredCheckins]);

  const strengthSeries = useMemo(() => {
    return extractStrengthSeries(allCompletions, startYMD, endYMD);
  }, [allCompletions, startYMD, endYMD]);

  const strengthCards = useMemo(() => {
    return (Object.keys(LIFT_LABELS) as LiftKey[]).map((lift) => {
      const points = strengthSeries[lift] || [];
      const latest = points.length ? points[points.length - 1].value : null;
      const prev = points.length > 1 ? points[points.length - 2].value : null;
      const delta = latest != null && prev != null ? latest - prev : null;

      return {
        key: lift,
        label: LIFT_LABELS[lift],
        latest,
        delta,
        labels: points.map((p) => fmtShortDate(p.date)),
        values: points.map((p) => p.value),
      };
    });
  }, [strengthSeries]);

  return (
    <>
      <Head>
        <title>Progress • Iron Acre Gym</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-2 ia-progress-page">
        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-kicker">
            <i className="fas fa-chart-line" />
            progress
          </div>

          <div className="d-flex justify-content-between align-items-start gap-2 mt-1 flex-wrap">
            <div className="ia-progress-header-copy">
              <div className="ia-page-title">Progress</div>
              <div className="ia-page-subtitle">
                Track weight, strength and consistency over time.
              </div>
            </div>

            <div className="d-flex gap-2">
              <Link href="/checkin">
                <i className="fas fa-plus" />
              </Link>

              <Link href="/schedule">
                <i className="fas fa-calendar-alt" />
              </Link>
            </div>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
            <div className="d-flex gap-2 flex-wrap">
              <button
                type="button"
                className={scope === "program" && !!currentProgram ? "ia-seg-btn ia-seg-btn-active" : "ia-seg-btn"}
                onClick={() => currentProgram && setScope("program")}
                disabled={!currentProgram}
              >
                Program
              </button>

              <button
                type="button"
                className={scope === "all" ? "ia-seg-btn ia-seg-btn-active" : "ia-seg-btn"}
                onClick={() => setScope("all")}
              >
                All time
              </button>
            </div>

            <div className="d-flex gap-2 flex-wrap">
              {(["7d", "30d", "90d"] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={range === r ? "ia-seg-btn ia-seg-btn-active" : "ia-seg-btn"}
                  onClick={() => setRange(r)}
                >
                  {r.replace("d", "D")}
                </button>
              ))}
            </div>
          </div>

          {scope === "program" && currentProgram ? (
            <div className="text-dim small mt-2">
              {currentProgram.program_name} • Week {currentProgram.current_week || 1} of{" "}
              {currentProgram.weeks || 1}
            </div>
          ) : (
            <div className="text-dim small mt-2">Viewing all-time progress</div>
          )}
        </section>

        <section className="ia-tile ia-tile-pad mb-3 ia-progress-hero">
          <div className="row g-3 align-items-stretch">
            <div className="col-12 col-lg-8">
              <div className="ia-progress-weight-card">
                <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                  <div>
                    <div className="ia-kicker">weight</div>
                    <div className="ia-progress-weight-value">
                      {latestWeight?.weight_kg != null ? latestWeight.weight_kg.toFixed(1) : "—"}kg
                    </div>
                    <div className="text-dim small mt-1">
                      {latestWeight?.date ? fmtShortDate(latestWeight.date) : "No check-ins yet"}
                    </div>
                  </div>

                  <div className="ia-progress-delta-pill">
                    <div className={weightDeltaKg <= 0 ? "ia-delta-good" : "ia-delta-bad"}>
                      {weightDeltaKg > 0 ? "+" : ""}
                      {weightDeltaKg.toFixed(1)}kg
                    </div>
                    <div className="text-dim small">
                      {weightDeltaPct > 0 ? "+" : ""}
                      {weightDeltaPct.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="ia-progress-chart-wrap mt-3">
                  {checkinsErr ? (
                    <div className="text-dim small">No check-ins yet.</div>
                  ) : filteredCheckins.length ? (
                    <Line data={weightChart.chartData} options={weightChart.options} />
                  ) : (
                    <div className="text-dim small">No weight data in this range.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-4">
              <div className="row g-2 h-100">
                <div className="col-4 col-lg-12">
                  <div className="ia-stat-mini h-100">
                    <div className="ia-stat-mini-value">{filteredSessions}</div>
                    <div className="ia-stat-mini-label">Sessions</div>
                  </div>
                </div>

                <div className="col-4 col-lg-12">
                  <div className="ia-stat-mini h-100">
                    <div className="ia-stat-mini-value">{Math.round(filteredCalories)}</div>
                    <div className="ia-stat-mini-label">Calories</div>
                  </div>
                </div>

                <div className="col-4 col-lg-12">
                  <div className="ia-stat-mini h-100">
                    <div className="ia-stat-mini-value">{currentStreak}</div>
                    <div className="ia-stat-mini-label">Day streak</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {completionsLoading ? (
            <div className="text-dim small mt-2">Loading all-time progress…</div>
          ) : null}

          {completionsErr ? (
            <div className="ia-inline-note-error mt-2">Unable to load completion history.</div>
          ) : null}
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="d-flex justify-content-between align-items-center gap-2">
            <div>
              <div className="ia-card-title-compact">Strength</div>
              <div className="text-dim small mt-1">Estimated 1RM trend by lift in the selected range.</div>
            </div>

            <Link href="/train">
              Open training
            </Link>
          </div>

          <div className="row g-2 mt-2">
            {strengthCards.map((card) => (
              <div key={card.key} className="col-6">
                <div className="ia-strength-card">
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div>
                      <div className="ia-strength-card-label">{card.label}</div>
                      <div className="ia-strength-card-value">
                        {card.latest != null ? `${Math.round(card.latest)} kg` : "—"}
                      </div>
                    </div>

                    <div className="text-end">
                      {card.delta != null ? (
                        <div className={card.delta >= 0 ? "ia-delta-good" : "ia-delta-bad"}>
                          {card.delta > 0 ? "+" : ""}
                          {Math.round(card.delta)}kg
                        </div>
                      ) : (
                        <div className="text-dim small">No change</div>
                      )}
                    </div>
                  </div>

                  <MiniSpark labels={card.labels} values={card.values} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="d-flex justify-content-between align-items-center gap-2">
            <div>
              <div className="ia-card-title-compact">Check-ins</div>
              <div className="text-dim small mt-1">Review historic check-ins and jump back into a specific day.</div>
            </div>

            <Link href="/checkin">
              Add check-in
            </Link>
          </div>

          {checkinsErr ? (
            <div className="text-dim small mt-3">No check-ins yet.</div>
          ) : !filteredCheckins.length ? (
            <div className="text-dim small mt-3">No check-ins in this selected range.</div>
          ) : (
            <div className="d-grid gap-2 mt-3">
              {[...filteredCheckins].reverse().map((c, idx) => {
                const ymd = c.date;
                return (
                  <div key={`${ymd}-${idx}`} className="ia-checkin-row">
                    <div className="ia-checkin-row-main">
                      <div className="ia-list-row-title">
                        {new Date(`${ymd}T00:00:00`).toLocaleDateString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-dim small mt-1">
                        {typeof c.weight_kg === "number" ? `${c.weight_kg} kg` : "—"} •{" "}
                        {typeof c.body_fat_pct === "number" ? `${c.body_fat_pct}% body fat` : "—"}
                      </div>
                    </div>

                    <div className="d-flex gap-2 flex-wrap">
                      <Link href="{`/checkin?date=${encodeURIComponent(ymd)}`}">
                        Edit
                      </Link>

                      {c.photo_url ? (
                        {c.photo_url}
                          Photo
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </>
  );
}
