import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import BottomNav from "../../../components/BottomNav";
import { IA, neonCardStyle } from "../../../components/iron-acre/theme";
import { BIG_LIFTS, resolveProfileLift, type StrengthProfile } from "../../../lib/iron-acre/strengthLifts";

const fetcher = async (u: string) => {
  const r = await fetch(u);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || `Request failed (${r.status})`);
  return j;
};

function formatUpdatedAt(v: any): string | null {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") {
      const d = v.toDate();
      return d && !isNaN(d.getTime()) ? d.toLocaleDateString() : null;
    }
    if (typeof v === "object" && typeof v._seconds === "number") {
      const d = new Date(v._seconds * 1000);
      return !isNaN(d.getTime()) ? d.toLocaleDateString() : null;
    }
    const d = new Date(v);
    return !isNaN(d.getTime()) ? d.toLocaleDateString() : null;
  } catch {
    return null;
  }
}

export default function IronAcreStrengthIndexPage() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data } = useSWR(mounted ? "/api/strength/profile/get" : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const profile: StrengthProfile | undefined = data?.profile;

  const updatedLabel = useMemo(() => {
    return formatUpdatedAt(profile?.updated_at);
  }, [profile?.updated_at]);

  if (!mounted) return null;

  if (status === "loading") {
    return (
      <main className="container py-4" style={{ color: "#fff" }}>
        Loading…
      </main>
    );
  }

  if (!session) {
    const cb = encodeURIComponent("/iron-acre/strength");
    return (
      <>
        <Head>
          <title>Strength • Iron Acre</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </Head>

        <main className="container py-4" style={{ color: "#fff", paddingBottom: 90 }}>
          <section className="futuristic-card p-3" style={neonCardStyle()}>
            <h2 className="m-0">Strength</h2>
            <div className="text-dim mt-2">Please sign in to view your strength history.</div>
            <div className="mt-3">
              <Link href={`/register?callbackUrl=${cb}`} className="btn btn-outline-light" style={{ borderRadius: 24 }}>
                Sign in
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
        <title>Strength • Iron Acre</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <main className="container py-3" style={{ color: "#fff", paddingBottom: 90 }}>
        <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
          <div className="d-flex justify-content-between align-items-start gap-2">
            <div style={{ minWidth: 0 }}>
              <div className="text-dim small">Iron Acre</div>
              <h1 className="h5 m-0" style={{ fontWeight: 800 }}>
                Strength
              </h1>
              <div className="text-dim small mt-1">e1RM trend by lift with true 1RM singles overlay.</div>
            </div>

            {updatedLabel ? (
              <span className="badge" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>
                Updated {updatedLabel}
              </span>
            ) : null}
          </div>
        </section>

        <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6 className="m-0">Main lifts</h6>

            <span
              className="badge"
              style={{
                background: `rgba(24,255,154,0.12)`,
                color: IA.neon,
                border: `1px solid ${IA.borderSoft}`,
              }}
            >
              e1RM + 1RM
            </span>
          </div>

          <div className="d-flex flex-column" style={{ gap: 10 }}>
            {BIG_LIFTS.map((lift, idx) => {
              const { true1rm, trainingMax } = resolveProfileLift(profile, lift);
              const value = true1rm ?? trainingMax ?? null;
              const source = true1rm != null ? "True 1RM" : trainingMax != null ? "Training max" : "Not set";

              return (
                <Link
                  key={lift.key}
                  href={`/iron-acre/strength/${lift.key}`}
                  className="d-flex justify-content-between align-items-center"
                  style={{
                    paddingTop: 10,
                    paddingBottom: 10,
                    borderTop: idx === 0 ? "none" : "1px solid rgba(255,255,255,0.08)",
                    textDecoration: "none",
                    color: "#fff",
                    gap: 12,
                  }}
                  aria-label={`Open ${lift.label} strength details`}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="fw-semibold">{lift.label}</div>
                    <div className="text-dim small">{source}</div>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <div
                      style={{
                        color: value != null ? IA.neon : "#888",
                        fontWeight: 900,
                        fontSize: "1.1rem",
                        textShadow: value != null ? `0 0 10px ${IA.neon}40` : "none",
                        minWidth: 70,
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {value != null ? `${value}kg` : "—"}
                    </div>

                    <i className="fas fa-chevron-right text-dim" />
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-3 d-flex gap-2">
            <Link href="/iron-acre" className="btn btn-sm btn-outline-light" style={{ borderRadius: 24 }}>
              Back
            </Link>
          </div>
        </section>
      </main>

      <BottomNav />
    </>
  );
}
