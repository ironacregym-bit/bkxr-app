import Head from "next/head";
import Link from "next/link";
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

/* ----------------------------- Types ----------------------------- */

type CheckinRow = {
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
};

type CheckinsSeriesResp = {
  results: CheckinRow[];
};

type RangeDays = 7 | 30 | 90;

type WeightDerived = {
  latestWeight: number | null;
  avgWeight: number | null;
  delta: number | null;
  subtitle: string;
  chartData: ChartData<"line"> | null;
  chartOptions: ChartOptions<"line"> | null;
};

/* ---------------------------- Helpers ---------------------------- */

const fetcher = async (u: string) => {
  const r = await fetch(u);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `Request failed (${r.status})`);
  return j;
};

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function subtitleForRange(range: RangeDays) {
  if (range === 7) return "Last 7 days";
  if (range === 30) return "Last 30 days";
  return "Last 90 days";
}

function toYMD(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : ymd(d);
}

function fmtShortDay(ymdStr: string) {
  const d = new Date(`${ymdStr}T00:00:00`);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
}

/* --------------------------- Component --------------------------- */

export default function IronAcreStrengthIndexPage() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  const [rangeDays, setRangeDays] = useState<RangeDays>(30);

  useEffect(() => setMounted(true), []);

  const { data: profResp } = useSWR(mounted ? "/api/strength/profile/get" : null, fetcher);
  const profile: StrengthProfile | undefined = profResp?.profile;

  const email = session?.user?.email ?? null;
  const checkinsKey =
    mounted && email
      ? `/api/checkins/series?email=${encodeURIComponent(email)}&limit=1000`
      : null;

  const { data: checkins } = useSWR<CheckinsSeriesResp>(checkinsKey, fetcher);

  const weightDerived = useMemo<WeightDerived>(() => {
    const subtitle = subtitleForRange(rangeDays);

    if (!checkins?.results?.length) {
      return { latestWeight: null, avgWeight: null, delta: null, subtitle, chartData: null, chartOptions: null };
    }

    const rows = checkins.results
      .map((r) => ({ ...r, ymd: toYMD(r.date) }))
      .filter((r): r is CheckinRow & { ymd: string } => Boolean(r.ymd))
      .sort((a, b) => a.ymd.localeCompare(b.ymd));

    const today = new Date();
    const startKey = ymd(addDays(today, -(rangeDays - 1)));
    const endKey = ymd(today);

    const usable = rows.filter((r) => r.ymd >= startKey && r.ymd <= endKey);
    const data = usable.length ? usable : rows.slice(-rangeDays);

    const weights = data.map((r) => r.weight_kg).filter((v): v is number => v != null);
    const latestWeight = weights.at(-1) ?? null;
    const avgWeight = weights.length ? +(weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1) : null;
    const delta = weights.length > 1 ? +(weights.at(-1)! - weights[0]).toFixed(1) : null;

    const chartData: ChartData<"line"> = {
      labels: data.map((r) => fmtShortDay(r.ymd)),
      datasets: [
        {
          label: "Weight (kg)",
          data: data.map((r) => r.weight_kg),
          borderColor: IA.neon,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.35,
          fill: true,
        } as ChartDataset<"line">,
      ],
    };

    const chartOptions: ChartOptions<"line"> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { display: false } },
      },
    };

    return { latestWeight, avgWeight, delta, subtitle, chartData, chartOptions };
  }, [checkins, rangeDays]);

  if (!mounted || status === "loading") return null;

  return (
    <>
      <Head>
        <title>Progress • Iron Acre</title>
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <section className="futuristic-card ia-tile ia-tile-pad mb-3">
          <div className="ia-page-title">Progress</div>
          <div className="ia-page-subtitle">{weightDerived.subtitle}</div>
        </section>

        <section className="futuristic-card ia-tile ia-tile-pad mb-3">
          <div style={{ height: 240 }}>
            {weightDerived.chartData && (
              <Line data={weightDerived.chartData} options={weightDerived.chartOptions!} />
            )}
          </div>
        </section>

        <section className="mb-3">
          <div className="ia-kicker mb-2">Strength</div>
          <div className="row g-2">
            {BIG_LIFTS.map((lift) => {
              const { true1rm, trainingMax } = resolveProfileLift(profile as any, lift);
              const value = true1rm ?? trainingMax ?? null;

              return (
                <div key={lift.key} className="col-6">
                  <Link href={`/iron-acre/strength/${lift.key}`} className="ia-link">
                    <div className="p-3 ia-lift-tile">
                      <div className="ia-lift-kicker">{lift.label}</div>
                      <div className="ia-lift-value">
                        {value ?? "—"}
                        <span className="ia-lift-unit">kg</span>
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
