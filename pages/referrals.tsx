
// pages/referrals.tsx
import Head from "next/head";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import BottomNav from "../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

export default function ReferralsPage() {
  const { status } = useSession();
  const isAuthed = status === "authenticated";
  const { data } = useSWR(isAuthed ? "/api/referrals/my" : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const link = data?.referral_link || "";
  const code = data?.referral_code || "";

  return (
    <>
      <Head>
        <title>Referrals • BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container py-3" style={{ paddingBottom: 80, color: "#fff" }}>
        <h1 className="fw-bold mb-3">Referrals</h1>

        <section className="futuristic-card p-3 mb-3">
          <h5 className="mb-2">Your Link</h5>
          {link ? (
            <>
              <div className="small text-dim mb-1">Share this link to invite friends:</div>
              <div className="d-flex align-items-center gap-2 mb-2" style={{ wordBreak: "break-all" }}>
                <span>{link}</span>
              </div>
              <div className="d-flex gap-2">
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
        </section>

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
                  {data.referrals.map((r: any, idx: number) => (
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
      </main>

      <BottomNav />
    </>
  );
}
