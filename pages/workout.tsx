
import Head from "next/head";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useMemo } from "react";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

// ---- helpers -------------------------------------------------
const ACCENT = "#ff8a2a";
const SOFT_BG = "rgba(255,255,255,0.05)";
const CARD: React.CSSProperties = {
  background: SOFT_BG,
  borderRadius: 16,
  padding: 16,
  backdropFilter: "blur(10px)",
  boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
const DAY_INDEX = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
function nextDateForDayName(dayName: string, from: Date) {
  const idx = DAY_INDEX.indexOf(dayName.toLowerCase());
  if (idx < 0) return null;
  const fromIdx = from.getDay();
  const diff = (idx - fromIdx + 7) % 7; // 0=today, 1=tomorrow, ...
  const target = new Date(from);
  target.setDate(from.getDate() + diff);
  target.setHours(0, 0, 0, 0);
  return target;
}

// Create tiny bar “charts” with plain divs (no extra packages)
function Bars({
  values,
  max,
  color,
  height = 48,
}: {
  values: number[];
  max: number;
  color: string;
  height?: number;
}) {
  const safeMax = Math.max(1, max, ...values);
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height }}>
      {values.map((v, i) => (
        <div
          key={i}
          title={`${v}`}
          style={{
            width: 10,
            height: Math.max(4, Math.round((v / safeMax) * height)),
            borderRadius: 6,
            background: color,
            boxShadow: `0 0 10px ${color}77`,
          }}
        />
      ))}
    </div>
  );
}

// ---- page ----------------------------------------------------
export default function Train() {
  const { data: session } = useSession();
  const today = useMemo(() => startOfDay(new Date()), []);
  const userEmail = session?.user?.email;

  // profile (for future location-based actions, not strictly required here)
  const { data: profile } = useSWR(
    userEmail ? `/api/profile?email=${encodeURIComponent(userEmail)}` : null,
    fetcher
  );

  // programmed workouts (supports both: old day_name and newer date-based)
  const { data: workoutsData } = useSWR("/api/workouts", fetcher);

  // workout completions (used for next workout + history + calories chart)
  const { data: completionData } = useSWR(
    userEmail ? `/api/completions/history?email=${encodeURIComponent(userEmail)}` : null,
    fetcher
  );

  // check-ins series for weight/bodyFat (optional; hide charts if not present)
  const { data: checkinSeries } = useSWR(
    userEmail ? `/api/checkins/series?email=${encodeURIComponent(userEmail)}&period=90d` : null,
    fetcher
  );

  // ---- derive: completed set
  const completedIds = useMemo(() => {
    const arr = completionData?.history ?? [];
    return new Set(arr.map((h: any) => h.workout_id).filter(Boolean));
  }, [completionData]);

  // ---- derive: next workout (not completed)
  const nextWorkout = useMemo(() => {
    const list: any[] = workoutsData?.workouts ?? [];
    if (!list.length) return null;

    // Normalize each workout to a comparable date and sort upcoming first
    const normalized = list
      .map((w) => {
        // prefer explicit timestamp/date if available
        if (w.date) {
          const dt = new Date(w.date);
          dt.setHours(0, 0, 0, 0);
          return { ...w, _date: dt };
        }
        if (w.day_name) {
          const dt = nextDateForDayName(w.day_name, today);
          return { ...w, _date: dt };
        }
        return { ...w, _date: null };
      })
      .filter((w) => w._date instanceof Date);

    // sort by date asc
    normalized.sort((a, b) => (a._date as Date).getTime() - (b._date as Date).getTime());

    // find the first upcoming not-completed (today counts as upcoming)
    for (const w of normalized) {
      const isUpcoming = (w._date as Date).getTime() >= today.getTime();
      if (isUpcoming && !completedIds.has(w.id)) return w;
      // fallback: if today matches and not completed yet, return it
      if (isSameDay(w._date as Date, today) && !completedIds.has(w.id)) return w;
    }
    // otherwise, if everything upcoming is completed, pick the next by date
    return normalized.find((w) => (w._date as Date).getTime() >= today.getTime()) ?? null;
  }, [workoutsData, completedIds, today]);

  // ---- derive: history preview
  const historyPreview = useMemo(() => {
    const arr: any[] = completionData?.history ?? [];
    // newest first
    return [...arr].sort((a, b) => +new Date(b.completed_date) - +new Date(a.completed_date)).slice(0, 3);
  }, [completionData]);

  // ---- derive: simple progress series
  // calories by week (last 8 entries bucketed by week number)
  const caloriesBars = useMemo(() => {
    const hist: any[] = completionData?.history ?? [];
    if (!hist.length) return { values: [], max: 0 };
    // Bucket by ISO week (year-week)
    const byWeek = new Map<string, number>();
    for (const h of hist) {
      const d = new Date(h.completed_date);
      const year = d.getUTCFullYear();
      // ISO week
      const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      const dayNum = (tmp.getUTCDay() + 6) % 7;
      tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
      const firstThursday = tmp.getTime();
      const jan4 = new Date(Date.UTC(year, 0, 4));
      const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
      jan4.setUTCDate(jan4.getUTCDate() - jan4DayNum + 3);
      const week = 1 + Math.round((firstThursday - jan4.getTime()) / 604800000);
      const key = `${year}-W${String(week).padStart(2, "0")}`;
      byWeek.set(key, (byWeek.get(key) ?? 0) + (h.calories_burned || 0));
    }
    const ordered = Array.from(byWeek.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .slice(-8);
    const values = ordered.map(([, v]) => Math.round(v));
    const max = Math.max(0, ...values);
    return { values, max };
  }, [completionData]);

  // weight/bodyFat series: expect checkinSeries like [{date, weight, bodyFat}]
  const weightSeries = useMemo<number[]>(() => {
    const arr: any[] = checkinSeries?.series ?? [];
    return arr.map((p) => p.weight).filter((n) => typeof n === "number").slice(-12);
  }, [checkinSeries]);
  const bodyFatSeries = useMemo<number[]>(() => {
    const arr: any[] = checkinSeries?.series ?? [];
    return arr.map((p) => p.bodyFat).filter((n) => typeof n === "number").slice(-12);
  }, [checkinSeries]);

  // ---- UI ----------------------------------------------------
  return (
    <>
      <Head>
        <title>BXKR · Train</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container py-3" style={{ paddingBottom: 80, color: "#fff" }}>
        {/* Header / CTA row */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h1 className="m-0" style={{ fontWeight: 800, fontSize: "1.3rem" }}>Train</h1>
          <Link href="/schedule" className="btn btn-outline-light btn-sm" style={{ borderRadius: 24 }}>
            Schedule
          </Link>
        </div>

        {/* Next Workout (not completed) */}
        <section style={{ ...CARD, marginBottom: 16 }}>
          <div className="d-flex justify-content-between align-items-start flex-wrap">
            <div className="mb-2">
              <div className="text-muted small">Next Workout</div>
              <h5 className="mb-1" style={{ fontWeight: 700 }}>
                {nextWorkout?.workout_name || nextWorkout?.name || "No programmed workout"}
              </h5>
              {nextWorkout?._date && (
                <div className="small text-muted">
                  {(nextWorkout._date as Date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}
                </div>
              )}
            </div>
            <div className="text-end mb-2">
              {nextWorkout ? (
                <Link
                  href={`/workout/${nextWorkout.id}`}
                  className="btn btn-sm"
                  style={{
                    borderRadius: 24,
                    fontWeight: 700,
                    color: "#fff",
                    background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`,
                    boxShadow: `0 0 14px ${ACCENT}88`,
                  }}
                >
                  Start Workout
                </Link>
              ) : (
                <Link href="/schedule" className="btn btn-outline-light btn-sm" style={{ borderRadius: 24 }}>
                  Book Session
                </Link>
              )}
            </div>
          </div>
          {nextWorkout?.notes && <p className="mb-0 mt-2" style={{ opacity: 0.9 }}>{nextWorkout.notes}</p>}
        </section>

        {/* Progress (Charts) */}
        <section style={{ ...CARD, marginBottom: 16 }}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="m-0" style={{ fontWeight: 700 }}>Progress</h6>
            <div className="small text-muted">Week · Month · All</div>
          </div>
          <div className="row g-3">
            <div className="col-4">
              <div className="small text-muted mb-1">Calories (weekly)</div>
              {caloriesBars.values.length ? (
                <Bars values={caloriesBars.values} max={caloriesBars.max} color={`${ACCENT}`} />
              ) : (
                <div className="small text-muted">No data yet</div>
              )}
            </div>
            <div className="col-4">
              <div className="small text-muted mb-1">Weight</div>
              {weightSeries.length ? (
                <Bars values={weightSeries} max={Math.max(...weightSeries)} color="#64c37a" />
              ) : (
                <div className="small text-muted">Connect check-ins</div>
              )}
            </div>
            <div className="col-4">
              <div className="small text-muted mb-1">% Body Fat</div>
              {bodyFatSeries.length ? (
                <Bars values={bodyFatSeries} max={Math.max(...bodyFatSeries)} color="#5b7c99" />
              ) : (
                <div className="small text-muted">Connect check-ins</div>
              )}
            </div>
          </div>
        </section>

        {/* Tiles */}
        <section className="row gx-3">
          {/* Workout History */}
          <div className="col-12 col-md-6 mb-3">
            <div style={{ ...CARD, height: "100%" }}>
              <h6 className="mb-3" style={{ fontWeight: 700 }}>Workout History</h6>
              {historyPreview.length ? (
                historyPreview.map((c: any, idx: number) => (
                  <div key={idx} className="mb-2">
                    <small className="text-muted">
                      {new Date(c.completed_date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    </small>
                    <div>{Math.round(c.calories_burned || 0)} kcal · {c.sets_completed || 0} sets</div>
                    {c.weight_completed_with && <div className="small text-muted">Weight used: {c.weight_completed_with}</div>}
                  </div>
                ))
              ) : (
                <div className="text-muted">No history yet</div>
              )}
              <Link href="/history" className="btn btn-outline-light btn-sm mt-2" style={{ borderRadius: 24 }}>
                View More
              </Link>
            </div>
          </div>

          {/* Benchmarks */}
          <BenchmarksCard email={userEmail} />
        </section>

        {/* Exercise Library */}
        <section style={{ ...CARD, marginTop: 4 }}>
          <div className="d-flex justify-content-between align-items-center">
            <h6 className="m-0" style={{ fontWeight: 700 }}>Exercise Library</h6>
            <Link href="/exercises" className="btn btn-outline-light btn-sm" style={{ borderRadius: 24 }}>
              Browse
            </Link>
          </div>
          <div className="small text-muted mt-2">Boxing · Kettlebell · Strength · Mobility</div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}

// ---- Benchmarks (soft-fail if API missing) -------------------
function BenchmarksCard({ email }: { email?: string | null }) {
  const { data, error } = useSWR(
    email ? `/api/benchmarks/latest?email=${encodeURIComponent(email)}` : null,
    fetcher
  );
  const has = data?.results?.length;

  return (
    <div className="col-12 col-md-6 mb-3">
      <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16, backdropFilter: "blur(10px)", boxShadow: "0 4px 20px rgba(0,0,0,0.4)", height: "100%" }}>
        <h6 className="mb-3" style={{ fontWeight: 700 }}>Benchmarks</h6>
        {has ? (
          <div>
            {data.results.slice(0, 3).map((r: any, i: number) => (
              <div key={i} className="mb-2">
                <div className="fw-semibold">{r.name}</div>
                <div className="small text-muted">{r.value} {r.unit} · {new Date(r.date).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-muted">Can’t load benchmarks</div>
        ) : (
          <div className="text-muted">No benchmarks yet</div>
        )}
        <div className="mt-2 d-flex gap-2">
          <Link href="/benchmarks" className="btn btn-outline-light btn-sm" style={{ borderRadius: 24 }}>View</Link>
          <Link href="/benchmarks/new" className="btn btn-sm" style={{ borderRadius: 24, color: "#fff", background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)`, boxShadow: `0 0 14px ${ACCENT}88` }}>
            Add Result
          </Link>
        </div>
      </div>
       </div>
  );

