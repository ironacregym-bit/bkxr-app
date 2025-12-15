
"use client";

import Head from "next/head";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useMemo } from "react";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

// ---- Brand + card styling ---------------------------------------------------
const ACCENT = "#FF8A2A";
const CARD: React.CSSProperties = {
  background: "rgba(255,255,255,0.05)",
  borderRadius: 16,
  padding: 16,
  backdropFilter: "blur(10px)",
  boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
};

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
    const src = histPrimary?.results ||
      histPrimary?.items ||
      histPrimary?.completions ||
      histPrimary?.data ||
      histFallback?.results ||
      histFallback?.items ||
      histFallback?.completions ||
      histFallback?.data ||
      [];

    const arr = Array.isArray(src) ? src : [];
    // Ensure we have the fields we render
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
      }))
      .filter((c: any) => !!c.completed_date)
      // newest first
      .sort((a: any, b: any) => (b.completed_date as Date).getTime() - (a.completed_date as Date).getTime())
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
          background: "linear-gradient(135deg,#0E0F12,#151923)",
          color: "#fff",
          borderRadius: 12,
          minHeight: "100vh",
        }}
      >
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div>
            <h1 className="h4 mb-0" style={{ fontWeight: 700 }}>
              Train
            </h1>
            <small style={{ opacity: 0.75 }}>Build momentum today</small>
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
            <Link
              href="/workouts/new?visibility=private"
              className="btn btn-outline-light btn-sm"
              style={{ borderRadius: 24 }}
            >
              Create
            </Link>
          </div>
        </div>

        {/* Tiles */}
        <section className="row gx-3">
          {/* Workout History */}
          <div className="col-12 col-md-6 mb-3">
            <div style={{ ...CARD, height: "100%" }}>
              <h6 className="mb-3" style={{ fontWeight: 700 }}>
                Workout History
              </h6>

              {historyPreview.length ? (
                historyPreview.map((c: any, idx: number) => (
                  <div key={idx} className="mb-2">
                    <small className="text-muted">
                      {new Date(c.completed_date).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                    </small>
                    <div>{Math.round(c.calories_burned || 0)} kcal · {c.sets_completed || 0} sets</div>
                    {c.weight_completed_with != null && (
                      <div className="small text-muted">Weight used: {c.weight_completed_with}</div>
                    )}
                  </div>
                ))
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

          {/* Benchmarks */}
          <BenchmarksCard email={userEmail} />
        </section>

        {/* Exercise Library */}
        <section style={{ ...CARD, marginTop: 4 }}>
          <div className="d-flex justify-content-between align-items-center">
            <h6 className="m-0" style={{ fontWeight: 700 }}>
              Exercise Library
            </h6>
            <Link
              href="/exercises"
              className="btn btn-outline-light btn-sm"
              style={{ borderRadius: 24 }}
            >
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

// ---- Benchmarks (soft‑fail if API missing) ----------------------------------
function BenchmarksCard({ email }: { email?: string | null }) {
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

  return (
    <div className="col-12 col-md-6 mb-3">
      <div style={{ ...CARD, height: "100%" }}>
        <h6 className="mb-3" style={{ fontWeight: 700 }}>
          Benchmarks
        </h6>

        {has ? (
          <div>
            {data.results.slice(0, 3).map((r: any, i: number) => (
              <div key={i} className="mb-2">
                <div className="fw-semibold">{r.name}</div>
                <div className="small text-muted">
                  {r.value} {r.unit} ·{" "}
                  {r.date ? new Date(r.date).toLocaleDateString() : ""}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-muted">Can’t load benchmarks</div>
        ) : (
          <div className="text-muted">No benchmarks yet</div>
        )}

        <div className="mt-2 d-flex gap-2">
          <Link
            href="/benchmarks"
            className="btn btn-outline-light btn-sm"
            style={{ borderRadius: 24 }}
          >
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
    </div>
  );
}
