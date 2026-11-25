// pages/admin/referrals/payouts.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";
import BottomNav from "../../../components/BottomNav";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const ACCENT = "#FF8A2A";

type Payout = {
  id: string;
  referrer_email: string;
  amount_gbp: number;
  currency: string;
  status: "pending" | "approved" | "paid" | "rejected";
  created_at: string;
  paid_at?: string | null;
  rejected_at?: string | null;
  transfer_id?: string | null;
  stripe_connect_id?: string | null;
  entries: Array<{ referral_doc_id: string; invoice_id: string; amount: number }>;
};

export default function AdminPayoutsPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role || "user";
  const isAllowed = !!session && (role === "admin" || role === "gym");

  const [statusFilter, setStatusFilter] = useState<string>("pending");

  const key = isAllowed ? `/api/referrals/payout/admin-list${statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : ""}` : null;
  const { data, mutate } = useSWR<{ payouts: Payout[] }>(key, fetcher, { revalidateOnFocus: false, dedupingInterval: 30_000 });

  const payouts = useMemo(() => Array.isArray(data?.payouts) ? data!.payouts : [], [data?.payouts]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function updateStatus(id: string, action: "paid" | "rejected") {
    setBusyId(id);
    setMsg(null);
    try {
      const r = await fetch("/api/referrals/payout/admin-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payout_id: id, action }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Failed to update payout");
      await mutate();
      setMsg(`Payout ${action} ✔`);
    } catch (e: any) {
      setMsg(e?.message || "Failed to update");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Head><title>Admin • Referral Payouts</title></Head>
      <main className="container py-3" style={{ paddingBottom: 90, color: "#fff" }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <Link href="/admin" className="btn btn-outline-secondary">← Back to Admin</Link>
          <h2 className="m-0">Referral Payouts</h2>
          <div />
        </div>

        {!isAllowed ? (
          <div className="container py-4">
            <h3>Access Denied</h3>
            <p>You do not have permission to view this page.</p>
          </div>
        ) : (
          <>
            <section className="futuristic-card p-3 mb-3">
              <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 8 }}>
                <div className="d-flex align-items-center gap-2">
                  <label className="form-label m-0 me-2">Status</label>
                  <select className="form-select" style={{ width: 200 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="rejected">Rejected</option>
                    <option value="">All</option>
                  </select>
                </div>
                {msg && <div className={`alert ${msg.includes("Failed") ? "alert-danger" : "alert-info"} py-1 px-2 m-0`}>{msg}</div>}
              </div>
            </section>

            <section className="futuristic-card p-3">
              {payouts.length === 0 ? (
                <div className="text-dim">No payouts found.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-dark table-sm align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Created</th>
                        <th>Referrer</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Transfer</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payouts.map((p) => (
                        <>
                          <tr key={p.id}>
                            <td>{new Date(p.created_at).toLocaleString("en-GB")}</td>
                            <td>{p.referrer_email}</td>
                            <td>£{Number(p.amount_gbp || 0).toFixed(2)}</td>
                            <td className="text-capitalize">{p.status}</td>
                            <td>{p.transfer_id ? <code>{p.transfer_id}</code> : <span className="text-dim">—</span>}</td>
                            <td>
                              <div className="d-flex gap-2">
                                <button
                                  className="btn btn-sm btn-outline-light"
                                  style={{ borderRadius: 24 }}
                                  onClick={() => setOpenRow(openRow === p.id ? null : p.id)}
                                >
                                  {openRow === p.id ? "Hide" : "Details"}
                                </button>

                                {/* Mark Paid */}
                                {p.status !== "paid" && (
                                  <button
                                    className="btn btn-sm"
                                    style={{
                                      borderRadius: 24,
                                      border: `1px solid ${ACCENT}`,
                                      color: ACCENT,
                                      background: "transparent",
                                      boxShadow: `0 0 10px ${ACCENT}55`,
                                    }}
                                    onClick={() => updateStatus(p.id, "paid")}
                                    disabled={busyId === p.id}
                                    title="Mark payout as paid (entries become paid)"
                                  >
                                    {busyId === p.id ? "Saving…" : "Mark Paid"}
                                  </button>
                                )}

                                {/* Reject */}
                                {p.status !== "rejected" && p.status !== "paid" && (
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    style={{ borderRadius: 24 }}
                                    onClick={() => updateStatus(p.id, "rejected")}
                                    disabled={busyId === p.id}
                                    title="Reject payout (entries return to unpaid)"
                                  >
                                    {busyId === p.id ? "Saving…" : "Reject"}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {openRow === p.id && (
                            <tr key={`${p.id}-details`}>
                              <td colSpan={6}>
                                <div className="p-2" style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12 }}>
                                  <div className="small text-dim mb-2">Entries ({p.entries?.length || 0})</div>
                                  <div className="table-responsive">
                                    <table className="table table-dark table-sm mb-0">
                                      <thead>
                                        <tr>
                                          <th>Referral Doc</th>
                                          <th>Invoice</th>
                                          <th>Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(p.entries || []).map((e, i) => (
                                          <tr key={`${p.id}-e-${i}`}>
                                            <td><code>{e.referral_doc_id}</code></td>
                                            <td><code>{e.invoice_id}</code></td>
                                            <td>£{Number(e.amount || 0).toFixed(2)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </>
  );
}
