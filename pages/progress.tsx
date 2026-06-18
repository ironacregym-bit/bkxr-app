"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import BottomNav from "../components/BottomNav";

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

type StrengthPoint = {
  date: string;
  value: number;
};

type StrengthCard = {
  key: string;
  title: string;
  latest: number | null;
  baseline: number | null;
  delta: number | null;
  points: StrengthPoint[];
  best_e1rm_kg?: number | null;
  best_true_1rm_kg?: number | null;
  training_max_kg?: number | null;
};

type Checkin = {
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  photo_url?: string | null;
};

type CompletionSeriesRow = {
  date: string;
  sessions: number;
  calories_burned: number;
  kg_lifted: number;
};

type ProgressOverviewResponse = {
  currentProgram: CurrentProgram;
  checkins: Checkin[];
  completionSeries: CompletionSeriesRow[];
  strengthCards: StrengthCard[];
  kpis: {
    totalCompletionsAllTime: number;
    totalCaloriesAllTime: number;
    totalKgLiftedAllTime: number;
    currentStreak: number;
  };
  debug?: {
    userEmail: string;
    checkinsFound: number;
    completionsFound: number;
    strengthExercisesFound: number;
    liftDocsFound: number;
    strengthCardsBuilt: number;
    matchedLiftIds: string[];
  };
};

type VisibleStrengthCard = {
  key: string;
  label: string;
  latest: number | null;
  baseline: number | null;
  deltaKg: number | null;
  deltaPct: number | null;
  points: StrengthPoint[];
  trainingMax: number | null;
  bestTrue1RM: number | null;
};

function formatYMD(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

function fmtShortDate(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function classNames(...items: Array<string | false | null | undefined>): string {
  return items.filter(Boolean).join(" ");
}

function rangeDaysToNumber(range: TimeRange): number {
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  return 90;
}

function fmtKg(value: number | null): string {
  if (value == null) return "—";
  return value % 1 === 0 ? `${value.toFixed(0)}kg` : `${value.toFixed(1)}kg`;
}

function LoadingScreen() {
  return (
    <main className="container py-4 ia-home-loading">
      <div className="ia-tile ia-tile-pad ia-home-loading-card">
        <div className="ia-home-loading-icon">
          <i className="fas fa-spinner fa-spin" />
        </div>
        <div className="ia-page-title">Loading progress</div>
        <div className="text-dim small mt-1">
          Pulling in your trends, check-ins and strength data.
        </div>
      </div>
    </main>
  );
}

function SectionLoadingCard({
  title,
  icon,
}: {
  title: string;
  icon: string;
}) {
  return (
    <section className="ia-tile ia-tile-pad mb-2 ia-section-loading">
      <div className="d-flex justify-content-between align-items-center">
        <div className="ia-kicker">
          <i className={`fas ${icon}`} />
          {title.toUpperCase()}
        </div>
        <i className="fas fa-spinner fa-spin text-dim" />
      </div>
      <div className="text-dim small mt-2">Loading {title.toLowerCase()}…</div>
    </section>
  );
}

function MiniSpark({
  points,
  accent = "#18ff9a",
}: {
  points: StrengthPoint[];
  accent?: string;
}) {
  if (!points.length) {
    return <div className="text-dim small mt-2">No data yet</div>;
  }

  const labels = points.map((p) => fmtShortDate(p.date));
  const values = points.map((p) => p.value);

  const chartData: ChartData<"line"> = {
    labels,
    datasets: [
      {
        label: "1RM",
        data: values,
        borderColor: accent,
        backgroundColor: "rgba(24,255,154,0.10)",
        tension: 0.35,
        pointRadius: 0,
        fill: true,
      } as ChartDataset<"line">,
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    scales: {
      x: { display: false },
      y: { display: false },
    },
    elements: {
      line: { borderWidth: 2 },
    },
  };

  return (
    <div style={{ height: 54, marginTop: 12 }}>
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

  const progressKey =
    mounted && status === "authenticated" ? "/api/progress/overview" : null;

  const { data, error, isValidating } = useSWR<ProgressOverviewResponse>(progressKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  useEffect(() => {
    if (!data) return;
    if (!data.currentProgram && scope === "program") {
      setScope("all");
    }
  }, [data, scope]);

  const scopeStartYMD = useMemo(() => {
    if (scope === "program" && data?.currentProgram?.start_date) {
      return data.currentProgram.start_date;
    }

    const firstCheckin = data?.checkins?.[0]?.date || null;
    const firstCompletion = data?.completionSeries?.[0]?.date || null;

    if (firstCheckin && firstCompletion) {
      return firstCheckin < firstCompletion ? firstCheckin : firstCompletion;
    }

    return firstCheckin || firstCompletion || formatYMD(startOfDay(new Date()));
  }, [data, scope]);

  const scopeEndYMD = useMemo(() => {
    if (scope === "program" && data?.currentProgram?.end_date) {
      return data.currentProgram.end_date;
    }
    return formatYMD(endOfDay(new Date()));
  }, [data, scope]);

  const selectedStartYMD = useMemo(() => {
    const today = startOfDay(new Date());
    const rangeStart = addDays(today, -(rangeDaysToNumber(range) - 1));
    const rangeStartYMD = formatYMD(rangeStart);
    return scopeStartYMD > rangeStartYMD ? scopeStartYMD : rangeStartYMD;
  }, [scopeStartYMD, range]);

  const selectedEndYMD = useMemo(() => {
    const todayYMD = formatYMD(endOfDay(new Date()));
    return scopeEndYMD < todayYMD ? scopeEndYMD : todayYMD;
  }, [scopeEndYMD]);

  const scopeCheckins = useMemo(() => {
    const rows = data?.checkins || [];
    return rows.filter((c) => c.date >= scopeStartYMD && c.date <= scopeEndYMD);
  }, [data, scopeStartYMD, scopeEndYMD]);

  const visibleCheckins = useMemo(() => {
    return scopeCheckins.filter((c) => c.date >= selectedStartYMD && c.date <= selectedEndYMD);
  }, [scopeCheckins, selectedStartYMD, selectedEndYMD]);

  const checkinsForDisplay = useMemo(() => {
    return visibleCheckins.length > 0 ? visibleCheckins : scopeCheckins;
  }, [visibleCheckins, scopeCheckins]);

  const scopeCompletionSeries = useMemo(() => {
    const rows = data?.completionSeries || [];
    return rows.filter((r) => r.date >= scopeStartYMD && r.date <= scopeEndYMD);
  }, [data, scopeStartYMD, scopeEndYMD]);

  const visibleCompletionSeries = useMemo(() => {
    const filtered = scopeCompletionSeries.filter(
      (r) => r.date >= selectedStartYMD && r.date <= selectedEndYMD
    );
    return filtered.length > 0 ? filtered : scopeCompletionSeries;
  }, [scopeCompletionSeries, selectedStartYMD, selectedEndYMD]);

  const weightBaseline = useMemo(() => {
    return (
      scopeCheckins.find((c) => typeof c.weight_kg === "number" && c.weight_kg != null) || null
    );
  }, [scopeCheckins]);

  const weightLatest = useMemo(() => {
    return (
      [...checkinsForDisplay]
        .reverse()
        .find((c) => typeof c.weight_kg === "number" && c.weight_kg != null) || null
    );
  }, [checkinsForDisplay]);

  const currentWeight = weightLatest?.weight_kg ?? null;
  const startWeight = weightBaseline?.weight_kg ?? null;

  const deltaKg = useMemo(() => {
    if (startWeight == null || currentWeight == null) return 0;
    return Number((currentWeight - startWeight).toFixed(1));
  }, [startWeight, currentWeight]);

  const deltaPct = useMemo(() => {
    if (startWeight == null || currentWeight == null || startWeight === 0) return 0;
    return Number((((currentWeight - startWeight) / startWeight) * 100).toFixed(1));
  }, [startWeight, currentWeight]);

  const visibleSessions = useMemo(() => {
    return visibleCompletionSeries.reduce((sum, row) => sum + Number(row.sessions || 0), 0);
  }, [visibleCompletionSeries]);

  const visibleKgLifted = useMemo(() => {
    return visibleCompletionSeries.reduce((sum, row) => sum + Number(row.kg_lifted || 0), 0);
  }, [visibleCompletionSeries]);

  const weightChart = useMemo(() => {
    const points = checkinsForDisplay
      .filter((p) => typeof p.weight_kg === "number" && p.weight_kg != null)
      .map((p) => ({ date: p.date, value: p.weight_kg as number }));

    if (!points.length) return null;

    const labels = points.map((p) => fmtShortDate(p.date));
    const values = points.map((p) => p.value);

    const chartData: ChartData<"line"> = {
      labels,
      datasets: [
        {
          label: "Weight (kg)",
          data: values,
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
      animation: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          ticks: {
            color: "#9fb0c3",
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 5,
          },
          grid: {
            color: "rgba(255,255,255,0.06)",
          },
        },
        y: {
          ticks: {
            color: "#9fb0c3",
          },
          grid: {
            color: "rgba(255,255,255,0.06)",
          },
        },
      },
      elements: {
        line: {
          borderWidth: 2.5,
        },
      },
    };

    return { chartData, options };
  }, [checkinsForDisplay]);

  const visibleStrengthCards = useMemo<VisibleStrengthCard[]>(() => {
    const cards = data?.strengthCards || [];

    return cards
      .map((card) => {
        const allPoints = Array.isArray(card.points) ? [...card.points] : [];
        allPoints.sort((a, b) => a.date.localeCompare(b.date));

        const rangedPoints = allPoints.filter(
          (p) => p.date >= selectedStartYMD && p.date <= selectedEndYMD
        );

        const points = rangedPoints.length > 0 ? rangedPoints : allPoints;

        const baseline =
          points.length > 0 ? points[0].value : card.baseline ?? card.latest ?? null;

        const latestFromPoints =
          points.length > 0 ? points[points.length - 1].value : null;

        const latestCandidates = [latestFromPoints, card.latest].filter(
          (v): v is number => typeof v === "number" && Number.isFinite(v)
        );

        const latest =
          latestCandidates.length > 0 ? Math.max(...latestCandidates) : null;

        const deltaKg =
          baseline != null && latest != null
            ? Number((latest - baseline).toFixed(1))
            : null;

        const deltaPct =
          baseline != null && latest != null && baseline > 0
            ? Number((((latest - baseline) / baseline) * 100).toFixed(1))
            : null;

        return {
          key: card.key,
          label: card.title,
          latest,
          baseline,
          deltaKg,
          deltaPct,
          points,
          trainingMax: card.training_max_kg ?? null,
          bestTrue1RM: card.best_true_1rm_kg ?? null,
        };
      })
      .filter((card) => card.latest != null || card.points.length > 0);
  }, [data, selectedStartYMD, selectedEndYMD]);

  const rangeLabel = useMemo(() => {
    return `${fmtShortDate(selectedStartYMD)} – ${fmtShortDate(selectedEndYMD)}`;
  }, [selectedStartYMD, selectedEndYMD]);

  const coreReady = mounted && status !== "loading" && (!session || !!data || !!error);

  if (!mounted || !coreReady) {
    return (
      <>
        <Head>
          <title>Progress • Iron Acre Gym</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </Head>
        <LoadingScreen />
        <BottomNav />
      </>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Progress • Iron Acre Gym</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-2 iron-acre-home">
        <section className="ia-tile ia-tile-pad mb-2">
          <div className="ia-kicker">
            <i className="fas fa-chart-line" />
            progress
          </div>

          <div className="d-flex justify-content-between align-items-start gap-2 mt-1">
            <div style={{ minWidth: 0 }}>
              <div className="ia-page-title">Progress</div>
              <div className="ia-page-subtitle">
                Track weight, strength and consistency over time.
              </div>
            </div>

            <div className="d-flex gap-2">
              /checkin
                <i className="fas fa-plus" />
              </Link>

              /schedule
                <i className="fas fa-calendar-alt" />
              </Link>
            </div>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-2">
          <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
            <div className="d-flex gap-2 flex-wrap">
              <button
                type="button"
                className={classNames(
                  "ia-btn",
                  scope === "program" && data?.currentProgram ? "ia-btn-primary" : "ia-btn-muted"
                )}
                onClick={() => data?.currentProgram && setScope("program")}
                disabled={!data?.currentProgram}
              >
                Program
              </button>

              <button
                type="button"
                className={classNames(
                  "ia-btn",
                  scope === "all" ? "ia-btn-primary" : "ia-btn-muted"
                )}
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
                  className={classNames(
                    "ia-btn",
                    range === r ? "ia-btn-primary" : "ia-btn-muted"
                  )}
                  onClick={() => setRange(r)}
                >
                  {r.replace("d", "D")}
                </button>
              ))}
            </div>
          </div>

          <div className="text-dim small mt-2">
            {scope === "program" && data?.currentProgram
              ? `${data.currentProgram.program_name} • Week ${data.currentProgram.current_week || 1} of ${data.currentProgram.weeks || 1}`
              : "Viewing all-time progress"}
            {rangeLabel ? ` • ${rangeLabel}` : ""}
          </div>
        </section>

        {error ? (
          <section className="ia-tile ia-tile-pad mb-2">
            <div className="ia-inline-note-error">Unable to load progress overview.</div>
          </section>
        ) : !data ? (
          <SectionLoadingCard title="Weight" icon="fa-chart-line" />
        ) : (
          <section className="ia-tile ia-tile-pad mb-2">
            <div className="row g-2 align-items-stretch">
              <div className="col-12 col-lg-8">
                <div
                  style={{
                    borderRadius: 16,
                    padding: 14,
                    minHeight: "100%",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                    <div>
                      <div className="ia-kicker">weight</div>
                      <div
                        style={{
                          fontSize: "2rem",
                          lineHeight: 1,
                          fontWeight: 900,
                          marginTop: 8,
                        }}
                      >
                        {currentWeight != null ? `${currentWeight.toFixed(1)}kg` : "—kg"}
                      </div>
                      <div className="text-dim small mt-1">
                        {startWeight != null
                          ? `Started at ${startWeight.toFixed(1)}kg`
                          : "No check-ins yet"}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "inline-flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        justifyContent: "center",
                        minWidth: 96,
                        minHeight: 56,
                        padding: "8px 10px",
                        borderRadius: 14,
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div
                        style={{
                          color: "var(--ia-info-text, #bfe3ff)",
                          fontWeight: 800,
                          fontSize: "1rem",
                          lineHeight: 1.1,
                        }}
                      >
                        {deltaKg > 0 ? "+" : ""}
                        {deltaKg.toFixed(1)}kg
                      </div>
                      <div
                        style={{
                          color: "var(--ia-info-text, #bfe3ff)",
                          fontWeight: 700,
                          fontSize: "0.82rem",
                          lineHeight: 1.1,
                          marginTop: 4,
                        }}
                      >
                        {deltaPct > 0 ? "+" : ""}
                        {deltaPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div style={{ height: 250, marginTop: 14 }}>
                    {weightChart ? (
                      <Line data={weightChart.chartData} options={weightChart.options} />
                    ) : (
                      <div className="text-dim small">No weight data available.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-4">
                <div className="row g-2 h-100">
                  <div className="col-4 col-lg-12">
                    <div className="ia-stat-mini h-100">
                      <div className="ia-stat-mini-value">{visibleSessions}</div>
                      <div className="ia-stat-mini-label">Sessions</div>
                    </div>
                  </div>

                  <div className="col-4 col-lg-12">
                    <div className="ia-stat-mini h-100">
                      <div className="ia-stat-mini-value">
                        {Math.round(visibleKgLifted)}kg
                      </div>
                      <div className="ia-stat-mini-label">KG lifted</div>
                    </div>
                  </div>

                  <div className="col-4 col-lg-12">
                    <div className="ia-stat-mini h-100">
                      <div className="ia-stat-mini-value">{data.kpis.currentStreak || 0}</div>
                      <div className="ia-stat-mini-label">Day streak</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {isValidating ? (
              <div className="text-dim small mt-2">Refreshing progress…</div>
            ) : null}
          </section>
        )}

        {!data ? (
          <SectionLoadingCard title="Strength" icon="fa-dumbbell" />
        ) : (
          <section className="ia-tile ia-tile-pad mb-2">
            <div className="d-flex justify-content-between align-items-center gap-2">
              <div>
                <div className="ia-card-title-compact">Strength</div>
                <div className="text-dim small mt-1">
                  True 1RM / estimated 1RM progression in the selected range.
                </div>
              </div>

              /train
                Open training
              </Link>
            </div>

            {!visibleStrengthCards.length ? (
              <div className="text-dim small mt-3">No strength data available.</div>
            ) : (
              <div className="row g-2 mt-2">
                {visibleStrengthCards.map((card) => (
                  <div key={card.key} className="col-6">
                    <div
                      style={{
                        borderRadius: 14,
                        padding: 12,
                        height: "100%",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-start gap-2">
                        <div style={{ minWidth: 0 }}>
                          <div
                            className="text-dim small"
                            style={{
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              fontWeight: 700,
                              lineHeight: 1.2,
                            }}
                          >
                            {card.label}
                          </div>

                          <div
                            style={{
                              fontSize: "1.12rem",
                              fontWeight: 800,
                              lineHeight: 1.2,
                              marginTop: 4,
                              color: "var(--ia-neon)",
                            }}
                          >
                            {card.latest != null ? fmtKg(card.latest) : "—"}
                          </div>

                          {card.trainingMax != null ? (
                            <div className="text-dim small mt-1">
                              TM {fmtKg(card.trainingMax)}
                            </div>
                          ) : null}
                        </div>

                        <div className="text-end">
                          {card.deltaKg != null ? (
                            <>
                              <div
                                style={{
                                  color: "var(--ia-info-text, #bfe3ff)",
                                  fontWeight: 800,
                                  fontSize: "0.95rem",
                                  lineHeight: 1.1,
                                }}
                              >
                                {card.deltaKg > 0 ? "+" : ""}
                                {fmtKg(card.deltaKg)}
                              </div>

                              <div
                                style={{
                                  color: "var(--ia-info-text, #bfe3ff)",
                                  fontWeight: 700,
                                  fontSize: "0.82rem",
                                  lineHeight: 1.1,
                                  marginTop: 4,
                                }}
                              >
                                {card.deltaPct != null
                                  ? `${card.deltaPct > 0 ? "+" : ""}${card.deltaPct}%`
                                  : ""}
                              </div>
                            </>
                          ) : (
                            <div className="text-dim small">No change</div>
                          )}
                        </div>
                      </div>

                      <MiniSpark points={card.points} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {!data ? (
          <SectionLoadingCard title="Check-ins" icon="fa-clipboard-check" />
        ) : (
          <section className="ia-tile ia-tile-pad mb-2">
            <div className="d-flex justify-content-between align-items-center gap-2">
              <div>
                <div className="ia-card-title-compact">Check-ins</div>
                <div className="text-dim small mt-1">
                  Review historic check-ins and jump back into a specific day.
                </div>
              </div>

              /checkin
                Add check-in
              </Link>
            </div>

            {!checkinsForDisplay.length ? (
              <div className="text-dim small mt-3">No check-ins available.</div>
            ) : (
              <div className="d-grid gap-2 mt-3">
                {[...checkinsForDisplay].reverse().map((c, idx) => (
                  <div
                    key={`${c.date}-${idx}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 0",
                      borderBottom:
                        idx === checkinsForDisplay.length - 1
                          ? "none"
                          : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                      <div className="ia-card-title-compact">
                        {new Date(`${c.date}T00:00:00`).toLocaleDateString(undefined, {
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
                      }`}
                        className="ia-btn ia-btn-outline"
                      >
                        Edit
                      </Link>

                      {c.photo_url ? (
                        {c.photo_url}
                          Photo
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <BottomNav />
    </>
  );
}
