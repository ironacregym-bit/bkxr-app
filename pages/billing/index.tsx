
// pages/billing/index.tsx
"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

type Profile = {
  email: string;
  subscription_status?: string; // active|trialing|past_due|paused|canceled|trial_ended|none
  is_premium?: boolean;
  trial_end?: string | null;
  stripe_customer_id?: string | null;
};

type Invoice = {
  id: string;
  number?: string | null;
  amount_paid?: number | null;     // in cents
  currency?: string | null;
  status?: string | null;          // paid|open|void|uncollectible
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  receipt_url?: string | null;
  created?: number | null;         // unix seconds
};

function daysLeft(iso?: string | null) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
  return d;
}

function formatMoney(amountCents?: number | null, currency?: string | null) {
  if (amountCents == null) return "-";
  const amount = amountCents / 100;
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: (currency || "GBP").toUpperCase(),
      minimumFractionDigits: 2
    }).format(amount);
  } catch {
    return `£${amount.toFixed(2)}`;
  }
}

function formatDateFromUnix(ts?: number | null) {
  if (!ts && ts !== 0) return "-";
  const d = new Date(ts * 1000);
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

export default function Billing() {
  const { status: authStatus } = useSession();
  const authed = authStatus === "authenticated";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  // Load profile (subscription status)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!authed) return;
      try {
        const r = await fetch("/api/profile");
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Failed to load profile");
        if (mounted) setProfile(j?.profile || null);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load profile");
      }
    })();
    return () => { mounted = false; };
  }, [authed]);

  // Load invoices/receipts
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!authed) return;
      try {
        const r = await fetch("/api/billing/invoices?limit=10");
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Failed to load invoices");
        if (mounted) setInvoices(Array.isArray(j?.invoices) ? j.invoices : []);
      } catch (e: any) {
        // Non-fatal: just show invoices section with message
        if (mounted) setInvoices([]);
      }
    })();
    return () => { mounted = false; };
  }, [authed]);

  const statusText = useMemo(() => profile?.subscription_status || "none", [profile]);
  const isActive = statusText === "active";
  const isTrial = statusText === "trialing";
  const isLocked = !isActive && !isTrial;
  const rem = daysLeft(profile?.trial_end);

  async function startTrial() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/create-checkout-session", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to create session");
      if (!j?.url) throw new Error("No checkout URL returned");
      window.location.href = j.url;
    } catch (e: any) {
      setError(e?.message || "Failed to start trial");
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/create-portal-session", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to open portal");
      if (!j?.url) throw new Error("No portal URL returned");
      window.location.href = j.url;
    } catch (e: any) {
      setError(e?.message || "Failed to open portal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head><title>Billing • BXKR</title></Head>
      <main className="container py-4" style={{ paddingBottom: 80, color: "#fff" }}>
        <h2 className="mb-3">Billing</h2>
        <p className="text-dim">Manage your subscription and view receipts securely via Stripe.</p>

        {!authed ? (
          <div className="alert alert-info">Please sign in to view billing.</div>
        ) : (
          <>
            <section className="futuristic-card p-3 mb-3">
              {!profile ? (
                <div className="text-muted">Loading your subscription…</div>
              ) : (
                <>
                  <div className="mb-2">
                    <strong>Status:</strong>{" "}
                    {isActive ? "Active (Premium)" : isTrial ? "Trialing" : statusText.replace("_", " ")}
                    {isTrial && typeof rem === "number" && (
                      <span className="text-muted"> • {rem > 0 ? `ends in ${rem} day${rem === 1 ? "" : "s"}` : "ends today"}</span>
                    )}
                  </div>

                  <div className="d-flex gap-2 flex-wrap">
                    {isActive && (
                      <button className="bxkr-btn" onClick={openPortal} disabled={busy}>
                        Manage Billing (Stripe Portal)
                      </button>
                    )}

                    {isTrial && (
                      <button className="bxkr-btn" onClick={openPortal} disabled={busy}>
                        Manage Billing (Stripe Portal)
                      </button>
                    )}

                    {isLocked && (
                      <>
                        <button className="btn-bxkr-outline" onClick={startTrial} disabled={busy}>
                          Start 14‑day Trial
                        </button>
                        <button className="bxkr-btn" onClick={openPortal} disabled={busy}>
                          Manage Billing (Stripe Portal)
                        </button>
                      </>
                    )}
                  </div>

                  {error && <div className="alert alert-danger mt-3">{error}</div>}
                </>
              )}
            </section>

            <section className="futuristic-card p-3">
              <h5 className="mb-2">Payments & Receipts</h5>
              {invoices === null ? (
                <div className="text-muted">Loading invoices…</div>
              ) : invoices.length === 0 ? (
                <div className="text-muted">No invoices found yet.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm table-dark align-middle">
                    <thead>
                      <tr>
                        <th style={{ whiteSpace: "nowrap" }}>Date</th>
                        <th>Invoice #</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((inv) => (
                        <tr key={inv.id}>
                          <td>{formatDateFromUnix(inv.created)}</td>
                          <td>{inv.number || inv.id.slice(0, 8)}</td>
                          <td>{formatMoney(inv.amount_paid, inv.currency)}</td>
                          <td className="text-capitalize">{inv.status || "-"}</td>
                          <td>
                            {inv.receipt_url ? (
                              <a href={inv.receipt_url} target="_blank" rel="noreferrer">View receipt</a>
                            ) : inv.hosted_invoice_url ? (
                              <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer">View invoice</a>
                            ) : inv.invoice_pdf ? (
                              <a href={inv.invoice_pdf} target="_blank" rel="noreferrer">Invoice PDF</a>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
