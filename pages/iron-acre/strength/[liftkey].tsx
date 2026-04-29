import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import BottomNav from "../../../components/BottomNav";
import { IA, neonCardStyle } from "../../../components/iron-acre/theme";
import {
  getLiftDef,
  resolveProfileLift,
  matchesLiftExerciseId,
  type StrengthProfile,
} from "../../../lib/iron-acre/strengthLifts";

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

type CompletionSet = { exercise_id: string; set: number; weight: number | null; reps: number | null };

type Completion = {
  id?: string;
  workout_id?: string | null;
  workout_name?: string | null;
  activity_type?: string | null;
  completed_date?: any;
  date_completed?: any;
  created_at?: any;
  sets?: CompletionSet[];
};

type CompletionsIndexResp = {
  results?: Completion[];
  items?: Completion[];
  completions?: Completion[];
  data?: Completion[];
  nextCursor?: string | null;
};

// Firestore timestamp parser (same idea as your progress.tsx)
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

// Epley e1RM
function epleyE1RM(weight: number, reps: number) {
  return weight * (1 + reps / 30);
}

export default function IronAcreStrengthLiftPage() {
  const router = useRouter();
  const { liftkey, liftKey } = router.query as any;

  // Support either param casing just in case
  const keyFromRoute = typeof liftKey === "string" ? liftKey : typeof liftkey === "string" ? liftkey : undefined;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const lift = useMemo(() => (typeof keyFromRoute === "string" ? getLiftDef(keyFromRoute) : undefined), [keyFromRoute]);

  const { data: profResp, error: profErr } = useSWR(mounted ? "/api/strength/profile/get" : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const profile: StrengthProfile | undefined = profResp?.profile;
  const email: string | null = profResp?.email || null;

  // Page all completions (same pattern as /progress)
  const PAGE_LIMIT = 500;
  const getKey = (pageIndex: number, previousPageData: CompletionsIndexResp | null) => {
    if (!mounted || !email || !lift) return null;
    if (previousPageData && !previousPageData.nextCursor) return null;

    const params = new URLSearchParams();
    params.set("user_email", email);
    params.set("limit", String(PAGE_LIMIT));
    if (pageIndex > 0 && previousPageData?.nextCursor) params.set("cursor", previousPageData.nextCursor);

    return `/api/completions?${params.toString()}`;
  };

  const { data: pages, error: compsErr, isValidating } = useSWRInfinite<CompletionsIndexResp>(getKey, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const allCompletions: Completion[] = useMemo(() => {
    const out: Completion[] = [];
    for (const p of pages || []) {
      const src = p?.results || p?.items || p?.completions || p?.data || [];
      if (Array.isArray(src)) out.push(...src);
    }
    return out;
  }, [pages]);

  const profVals = useMemo(() => {
    if (!lift) return { true1rm: null, trainingMax: null };
    return resolveProfileLift(profile, lift);
  }, [profile, lift]);

  const derived = useMemo(() => {
    const empty = {
      chartData: null as ChartData<"line"> | null,
      chartOptions: null as ChartOptions<"line"> | null,
      recentRows: [] as Array<{ ymd: string; weight: number; reps: number; e1rm: number; workoutName?: string | null }>,
      stats: {
        latestE1RM: null as number | null,
        bestE1RM: null as number | null,
        bestTrue1RM: null as number | null,
      },
    };

    if (!lift) return empty;

    // Aggregate per-day: max e1RM, max true 1RM (singles)
    const perDay = new Map<string, { maxE1RM: number; maxTrue1RM: number | null }>();

    // Also store recent sets for this lift
    const recent: Array<{ ymd: string; weight: number; reps: number; e1rm: number; workoutName?: string | null }> = [];

    for (const c of allCompletions) {
      const iso = toISO((c as any).completed_date) || toISO((c as any).date_completed) || toISO((c as any).created_at);
      if (!iso) continue;

      const ymd = iso.slice(0, 10);
      const sets = Array.isArray((c as any).sets) ? ((c as any).sets as CompletionSet[]) : [];

      for (const s of sets) {
        // ✅ THIS IS THE KEY CHANGE:
        // use canonical mapping (underscore IDs) AND allow legacy names
        if (!s?.exercise_id || !matchesLiftExerciseId(String(s.exercise_id), lift)) continue;

        const w = Number(s.weight);
        const r = Number(s.reps);
        if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) continue;

        const e1 = epleyE1RM(w, r);
        recent.push({
          ymd,
          weight: w,
          reps: r,
          e1rm: e1,
          workoutName: (c as any).workout_name || null,
        });

        const row = perDay.get(ymd) || { maxE1RM: 0, maxTrue1RM: null };
        if (e1 > row.maxE1RM) row.maxE1RM = e1;

        // True 1RM overlay points: best single per day
        if (r === 1) {
          row.maxTrue1RM = row.maxTrue1RM == null ? w : Math.max(row.maxTrue1RM, w);
        }

        perDay.set(ymd, row);
      }
    }

    const daysAsc = Array.from(perDay.entries())
      .map(([ymd, v]) => ({ ymd, ...v }))
      .sort((a, b) => a.ymd.localeCompare(b.ymd));

    const labels = daysAsc.map((d) =>
      new Date(d.ymd + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })
    );

    const e1rmSeries = daysAsc.map((d) => (d.maxE1RM > 0 ? Math.round(d.maxE1RM * 10) / 10 : null));
    const trueSeries = daysAsc.map((d) => (typeof d.maxTrue1RM === "number" ? d.maxTrue1RM : null));

    const numsE1 = e1rmSeries.filter((x): x is number => typeof x === "number");
    const numsTrue = trueSeries.filter((x): x is number => typeof x === "number");

    const bestE1RM = numsE1.length ? Math.max(...numsE1) : null;
    const latestE1RM = numsE1.length ? (e1rmSeries[e1rmSeries.length - 1] as number | null) : null;
    const bestTrue1RM = numsTrue.length ? Math.max(...numsTrue) : null;

    const cd: ChartData<"line"> = {
      labels,
      datasets: [
        {
          label: "e1RM (trend)",
          data: e1rmSeries as (number | null)[],
          borderColor: IA.neon,
          backgroundColor: "rgba(24,255,154,0.16)",
          tension: 0.3,
          pointRadius: 2,
          pointHoverRadius: 4,
        } as ChartDataset<"line">,
        {
          label: "True 1RM (singles)",
          data: trueSeries as (number | null)[],
          borderColor: IA.neon2,
          backgroundColor: "rgba(255,140,66,0.10)",
          showLine: false,
          pointRadius: 4,
          pointHoverRadius: 6,
        } as any,
      ],
    };

    const opts: ChartOptions<"line"> = {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#e9eef6" } },
        tooltip: { intersect: false, mode: "index" },
      },
      scales: {
        x: { ticks: { color: "#9fb0c3" }, grid: { color: "rgba(255,255,255,0.08)" } },
        y: { ticks: { color: "#9fb0c3" }, grid: { color: "rgba(255,255,255,0.08)" } },
      },
    };

    const recentRows = recent
      .sort((a, b) => (a.ymd === b.ymd ? 0 : b.ymd.localeCompare(a.ymd)))
      .slice(0, 12)
      .map((r) => ({ ...r, e1rm: Math.round(r.e1rm * 10) / 10 }));

    return {
      chartData: cd,
      chartOptions: opts,
      recentRows,
      stats: { latestE1RM, bestE1RM, bestTrue1RM },
    };
  }, [allCompletions, lift]);

  if (!mounted) return null;

  if (!lift) {
    return (
      <>
        <Head>
          <title>Strength • Iron Acre</title>
        </Head>

        <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
          <section className="futuristic-card p-3" style={neonCardStyle()}>
            <div className="fw-bold">Unknown lift</div>
            <div className="text-dim small mt-1">That lift key isn’t recognised.</div>

            <div className="mt-3">
              <Link href="/iron-acre/strength" className="btn btn-outline-light btn-sm" style={{ borderRadius: 24 }}>
                Back
              </Link>
            </div>
          </section>
        </main>

        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{lift.label} • Strength • Iron Acre</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
          <div className="d-flex justify-content-between align-items-start">
            <div style={{ minWidth: 0 }}>
              <div className="text-dim small">Strength</div>
              <div className="fw-bold" style={{ fontSize: "1.25rem", lineHeight: 1.1 }}>
                {lift.label}
              </div>
              <div className="text-dim small mt-1">e1RM trend with true 1RM singles overlay.</div>
            </div>

            <Link href="/iron-acre/strength" className="btn btn-sm btn-outline-light" style={{ borderRadius: 24 }}>
              Back
            </Link>
          </div>
        </section>

        <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
          <div className="row g-2">
            <div className="col-6 col-md-3">
              <div className="text-dim small">Latest e1RM</div>
              <div style={{ color: IA.neon, fontWeight: 900, fontSize: "1.15rem", textShadow: `0 0 10px ${IA.neon}40` }}>
                {derived.stats.latestE1RM != null ? `${derived.stats.latestE1RM}kg` : "—"}
              </div>
            </div>

            <div className="col-6 col-md-3">
              <div className="text-dim small">Best e1RM</div>
              <div style={{ color: IA.neon, fontWeight: 900, fontSize: "1.15rem", textShadow: `0 0 10px ${IA.neon}40` }}>
                {derived.stats.bestE1RM != null ? `${derived.stats.bestE1RM}kg` : "—"}
              </div>
            </div>

            <div className="col-6 col-md-3">
              <div className="text-dim small">Best true 1RM</div>
              <div style={{ color: IA.neon2, fontWeight: 900, fontSize: "1.15rem", textShadow: `0 0 10px ${IA.neon2}40` }}>
                {derived.stats.bestTrue1RM != null ? `${derived.stats.bestTrue1RM}kg` : "—"}
              </div>
            </div>

            <div className="col-6 col-md-3">
              <div className="text-dim small">Training max</div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: "1.05rem" }}>
                {profVals.trainingMax != null ? `${profVals.trainingMax}kg` : "—"}
              </div>
            </div>
          </div>

          {isValidating ? <div className="text-dim small mt-2">Loading history…</div> : null}
          {profErr ? <div className="text-danger small mt-2">Unable to load strength profile.</div> : null}
          {compsErr ? <div className="text-danger small mt-2">Unable to load completion history.</div> : null}
        </section>

        <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="m-0">Trend</h6>
            <span className="badge" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>
              e1RM line + 1RM points
            </span>
          </div>

          {!derived.chartData ? (
            <div className="text-dim">No lift data yet.</div>
          ) : (
            <Line data={derived.chartData} options={derived.chartOptions as any} />
          )}
        </section>

        <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="m-0">Recent sets</h6>
            <span className="badge" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>
              Top sets
            </span>
          </div>

          {derived.recentRows.length === 0 ? (
            <div className="text-dim">No sets recorded for this lift yet.</div>
          ) : (
            <div className="d-flex flex-column" style={{ gap: 10 }}>
              {derived.recentRows.map((r, idx) => (
                <div key={`${r.ymd}-${idx}`} style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="fw-semibold">
                      {r.weight}kg × {r.reps}
                      <span className="text-dim small" style={{ marginLeft: 8 }}>
                        (e1RM {r.e1rm}kg)
                      </span>
                    </div>
                    <div className="text-dim small">
                      {new Date(r.ymd + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    </div>
                  </div>

                  {r.workoutName ? <div className="text-dim small mt-1">{r.workoutName}</div> : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mb-2">
          <Link href="/iron-acre" className="text-dim small" style={{ textDecoration: "none" }}>
            <i className="fas fa-chevron-left" style={{ marginRight: 6 }} />
            Back to dashboard
          </Link>
        </div>
      </main>

      <BottomNav />
    </>
  );
}
