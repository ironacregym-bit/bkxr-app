// pages/progress.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
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
type LiftKey = "squat" | "bench" | "deadlift" | "ohp";

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

type ProgressOverviewResponse = {
  scope: ScopeMode;
  range: TimeRange;
  startYMD: string;
  endYMD: string;
  currentProgram: CurrentProgram;
  kpis: {
    sessions: number;
    calories: number;
    currentStreak: number;
    totalCompletionsAllTime: number;
  };
  weight: {
    start_weight_kg: number | null;
    current_weight_kg: number | null;
    delta_kg: number;
    delta_pct: number;
    points: Array<{ date: string; value: number }>;
  };
  strength: Record<
    LiftKey,
    {
      latest: number | null;
      previous: number | null;
      delta: number | null;
      points: StrengthPoint[];
    }
  >;
  checkins: Array<{
    date: string;
    weight_kg: number | null;
    body_fat_pct: number | null;
    photo_url?: string | null;
  }>;
};

const LIFT_LABELS: Record<LiftKey, string> = {
  squat: "Squat",
  bench: "Bench",
  deadlift: "Deadlift",
  ohp: "OHP",
};

function formatYMD(d: Date) {
  return d.toLocaleDateString("en-CA");
}

function fmtShortDate(ymd: string) {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function classNames(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(" ");
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

  const shouldLoad = mounted && status === "authenticated";

  const progressKey = shouldLoad
    ? `/api/progress/overview?scope=${encodeURIComponent(scope)}&range=${encodeURIComponent(range)}`
    : null;

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

  const weightChart = useMemo(() => {
    const points = data?.weight?.points || [];
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
            maxTicksLimit: 6,
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
  }, [data]);

  const strengthCards = useMemo(() => {
    const strength = data?.strength;
    if (!strength) return [];

    return (Object.keys(LIFT_LABELS) as LiftKey[]).map((lift) => ({
      key: lift,
      label: LIFT_LABELS[lift],
      latest: strength[lift]?.latest ?? null,
      previous: strength[lift]?.previous ?? null,
      delta: strength[lift]?.delta ?? null,
      points: strength[lift]?.points ?? [],
    }));
  }, [data]);

  const currentWeight = data?.weight?.current_weight_kg ?? null;
  const startWeight = data?.weight?.start_weight_kg ?? null;
  const deltaKg = data?.weight?.delta_kg ?? 0;
  const deltaPct = data?.weight?.delta_pct ?? 0;

  const rangeLabel = useMemo(() => {
    if (!data) return "";
    return `${fmtShortDate(data.startYMD)} – ${fmtShortDate(data.endYMD)}`;
  }, [data]);

  const loading = !mounted || status === "loading" || (shouldLoad && !data && !error);

  if (loading) {
    return (
      <>
        <Head>
          <title>Progress • Iron Acre Gym</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </Head>
        <main className="container py-2 ia-progress-page">
          <LoadingCard title="Loading Progress" />
        </main>
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
                className={classNames("ia-seg-btn", scope === "program" && data?.currentProgram && "ia-seg-btn-active")}
                onClick={() => data?.currentProgram && setScope("program")}
                disabled={!data?.currentProgram}
              >
                Program
              </button>

              <button
                type="button"
                className={classNames("ia-seg-btn", scope === "all" && "ia-seg-btn-active")}
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
                  className={classNames("ia-seg-btn", range === r && "ia-seg-btn-active")}
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
              : "Viewing all-time progress"}{" "}
            {rangeLabel ? `• ${rangeLabel}` : ""}
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3 ia-progress-hero">
          <div className="row g-3 align-items-stretch">
            <div className="col-12 col-lg-8">
              <div className="ia-progress-weight-card">
                <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                  <div>
                    <div className="ia-kicker">weight</div>
                    <div className="ia-progress-weight-value">
                      {currentWeight != null ? `${currentWeight.toFixed(1)}kg` : "—kg"}
                    </div>
                    <div className="text-dim small mt-1">
                      {startWeight != null ? `Started at ${startWeight.toFixed(1)}kg` : "No check-ins yet"}
                    </div>
                  </div>

                  <div className="ia-progress-delta-pill">
                    <div className={deltaKg <= 0 ? "ia-delta-good" : "ia-delta-bad"}>
                      {deltaKg > 0 ? "+" : ""}
                      {deltaKg.toFixed(1)}kg
                    </div>
                    <div className={deltaPct <= 0 ? "ia-delta-good small" : "ia-delta-bad small"}>
                      {deltaPct > 0 ? "+" : ""}
                      {deltaPct.toFixed(1)}%
                    </div>
                  </div>
                </div>

                <div className="ia-progress-chart-wrap mt-3">
                  {error ? (
                    <div className="text-dim small">Unable to load weight data.</div>
                  ) : weightChart ? (
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
                    <div className="ia-stat-mini-value">{data?.kpis.sessions || 0}</div>
                    <div className="ia-stat-mini-label">Sessions</div>
                  </div>
                </div>

                <div className="col-4 col-lg-12">
                  <div className="ia-stat-mini h-100">
                    <div className="ia-stat-mini-value">{Math.round(data?.kpis.calories || 0)}</div>
                    <div className="ia-stat-mini-label">Calories</div>
                  </div>
                </div>

                <div className="col-4 col-lg-12">
                  <div className="ia-stat-mini h-100">
                    <div className="ia-stat-mini-value">{data?.kpis.currentStreak || 0}</div>
                    <div className="ia-stat-mini-label">Day streak</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {isValidating ? (
            <div className="text-dim small mt-2">Refreshing progress…</div>
          ) : null}

          {error ? (
            <div className="ia-inline-note-error mt-2">Unable to load progress overview.</div>
          ) : null}
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="d-flex justify-content-between align-items-center gap-2">
            <div>
              <div className="ia-card-title-compact">Strength</div>
              <div className="text-dim small mt-1">
                Estimated 1RM trend by lift in the selected range.
              </div>
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

                  <MiniSpark points={card.points} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="d-flex justify-content-between align-items-center gap-2">
            <div>
              <div className="ia-card-title-compact">Check-ins</div>
              <div className="text-dim small mt-1">
                Review historic check-ins and jump back into a specific day.
              </div>
            </div>

            <Link href="/checkin">
              Add check-in
            </Link>
          </div>

          {!data?.checkins?.length ? (
            <div className="text-dim small mt-3">No check-ins in this selected range.</div>
          ) : (
            <div className="d-grid gap-2 mt-3">
              {data.checkins.map((c, idx) => (
                <div key={`${c.date}-${idx}`} className="ia-checkin-row">
                  <div className="ia-checkin-row-main">
                    <div className="ia-list-row-title">
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
                    <Link href="{`/checkin?date=${encodeURIComponent(c.date)}`}">
                      Edit
                    </Link>

                    {c.photo_url ? (
                      <a
                        href={c.photo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ia-btn ia-btn-primary"
                      >
                        Photo
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </>
  );
}
