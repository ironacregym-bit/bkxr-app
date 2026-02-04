// pages/referrals.tsx
"use client";

import Head from "next/head";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";
const MIN_PAYOUT_UI_GBP = 20; // Mirrors server default (MIN_PAYOUT_GBP) to guide button state

type MyReferralsResponse = {
  referral_code: string;
  referral_link: string;
  stats: {
    total_signups: number;
    active_paid: number;
    commission_rate: number; // decimal e.g. 0.05
    total_earned: number;    // GBP
  };
  referrals: Array<{
    email: string;
    status: string;
    converted_to_paid: boolean;
    first_payment_month: string | null;
    total_commission_from_user: number;
  }>;
};

export default function ReferralsPage() {
  const { status, data: session } = useSession();
  const isAuthed = status === "authenticated";

  const [backfillComplete, setBackfillComplete] = useState(false);

  // Auto‑backfill referral code if the user does not have one
  useEffect(() => {
    if (!isAuthed || !session?.user?.email) return;
    const flagKey = "referral_backfill_done";
    if (sessionStorage.getItem(flagKey) === "true") {
      setBackfillComplete(true);
      return;
    }
    (async () => {
      try {
        await fetch("/api/referrals/backfill-self", { method: "POST" });
      } catch {
        // non-blocking
      } finally {
        sessionStorage.setItem(flagKey, "true");
        setBackfillComplete(true);
      }
    })();
  }, [isAuthed, session?.user?.email]);

  // Load referral dashboard once backfill is complete
  const { data, error, isLoading, mutate } = useSWR<MyReferralsResponse>(
    isAuthed && backfillComplete ? "/api/referrals/my" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const link = data?.referral_link || "";
  const code = data?.referral_code || "";

  // Payout eligibility + request
  const [payout, setPayout] = useState<{ total?: number; loading?: boolean; error?: string | null }>({
    total: 0,
    loading: false,
    error: null,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isAuthed) return;
      try {
        const r = await fetch("/api/referrals/payout/eligibility");
        const j = await r.json();
        if (!mounted) return;
        setPayout({ total: Number(j?.total || 0), loading: false, error: null });
      } catch (e: any) {
        if (!mounted) return;
        setPayout({ total: 0, loading: false, error: e?.message || "Failed to load" });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isAuthed]);

  async function requestPayout() {
    setPayout((p) => ({ ...p, loading: true, error: null }));
    try {
      const r = await fetch("/api/referrals/payout/request", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to request payout");

      // Refresh eligibility and dashboard stats
      const r2 = await fetch("/api/referrals/payout/eligibility");
      const j2 = await r2.json();
      setPayout({ total: Number(j2?.total || 0), loading: false, error: null });
      mutate(); // refresh /my in case totals change

      alert(`Payout requested for £${Number(j?.amount_gbp || 0).toFixed(2)} (ID: ${j?.payout_id}).`);
    } catch (e: any) {
      setPayout((p) => ({ ...p, loading: false, error: e?.message || "Failed" }));
    }
  }

  return (
    <>
      <Head>
        <title>Referrals • BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container py-3" style={{ paddingBottom: 80, color: "#fff" }}>
        <h1 className="fw-bold mb-3">Referrals</h1>

        {/* Loading / Preparing */}
        {!isAuthed && (
          <div className="text-dim">Please sign in to view your referral dashboard.</div>
        )}
        {isAuthed && (!backfillComplete || isLoading) && (
          <div className="text-center mt-5">
            <span className="inline-spinner mb-2" />
            <div className="small text-dim mt-2">Preparing your referral dashboard…</div>
          </div>
        )}
        {error && (
          <div className="alert alert-danger">Failed to load referrals. Please try again.</div>
        )}

        {/* Content */}
        {isAuthed && data && (
          <>
            {/* Your Link */}
            <section className="futuristic-card p-3 mb-3">
              <h5 className="mb-2">Your Link</h5>
              {link ? (
                <>
                  <div className="small text-dim mb-1">Share this link to invite friends:</div>
                  <div className="d-flex align-items-center gap-2 mb-2" style={{ wordBreak: "break-all" }}>
                    <span>{link}</span>
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <button
                      className="btn btn-bxkr"
                      onClick={() => navigator.clipboard.writeText(link)}
                      style={{ borderRadius: 24, background: `linear-gradient(135deg, ${ACCENT}, #ff7f32)` }}
                    >
                      Copy Link
                    </button>
                    <a
                      className="btn btn-bxkr-outline"
                      style={{ borderRadius: 24 }}
                      href={`https://wa.me/?text=${encodeURIComponent(link)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Share
                    </a>
                  </div>
                </>
              ) : (
                <div className="text-dim">Your referral code is being prepared…</div>
              )}
            </section>

            {/* Stats + Payout */}
            <section className="futuristic-card p-3 mb-3">
              <h5 className="mb-2">Stats</h5>
              <div className="small text-dim mb-2">
                Commission increases with paid active referrals: 5% → 10% → 15% → 20% → 25% → 30%
              </div>
              <div className="d-flex flex-wrap gap-2">
                <span className="bxkr-chip">Signups: {data?.stats?.total_signups ?? 0}</span>
                <span className="bxkr-chip">Active Paid: {data?.stats?.active_paid ?? 0}</span>
                <span className="bxkr-chip">Rate: {(100 * (data?.stats?.commission_rate ?? 0)).toFixed(0)}%</span>
                <span className="bxkr-chip">Total Earned: £{Number(data?.stats?.total_earned ?? 0).toFixed(2)}</span>
              </div>

              {/* Payout Row */}
              <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
                <span className="bxkr-chip">
                  Eligible for payout: £{Number(payout?.total || 0).toFixed(2)}
                </span>
                <button
                  className="btn btn-bxkr-outline"
                  style={{ borderRadius: 24 }}
                  onClick={requestPayout}
                  disabled={
                    payout.loading ||
                    Number(payout?.total || 0) < MIN_PAYOUT_UI_GBP
                  }
                  title={`Request payout of unpaid commission (min £${MIN_PAYOUT_UI_GBP.toFixed(2)})`}
                >
                  {payout.loading ? "Requesting…" : `Request Payout`}
                </button>
                {payout.error && <div className="text-danger small">{payout.error}</div>}
                <div className="small text-dim ms-auto">
                  Minimum payout is £{MIN_PAYOUT_UI_GBP.toFixed(2)}. Payouts are reviewed before payment.
                </div>
              </div>
            </section>

            {/* Referred Users */}
            <section className="futuristic-card p-3 mb-3">
              <h5 className="mb-2">Referred Users</h5>
              {Array.isArray(data?.referrals) && data.referrals.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-dark table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Converted</th>
                        <th>First Paid</th>
                        <th>Total Commission</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.referrals.map((r, idx) => (
                        <tr key={idx}>
                          <td>{r.email}</td>
                          <td className="text-capitalize">{r.status}</td>
                          <td>{r.converted_to_paid ? "Yes" : "No"}</td>
                          <td>{r.first_payment_month || "—"}</td>
                          <td>£{Number(r.total_commission_from_user || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-dim">No referrals yet.</div>
              )}
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </>
  );
}
