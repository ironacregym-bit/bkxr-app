
// pages/billing/index.tsx
"use client";

import Head from "next/head";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BottomNav from "../../components/BottomNav";

type Profile = {
  email: string;
  subscription_status?: string; // active|trialing|past_due|paused|canceled|trial_ended|none
  is_premium?: boolean;
  trial_end?: string | null;
  stripe_customer_id?: string | null;
  name?: string | null;
  image?: string | null;
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
  return Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
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
  const router = useRouter();
  const { status: authStatus, data: session } = useSession();
  const search = useSearchParams();
  const authed = authStatus === "authenticated";
  const email = session?.user?.email ?? ""; // used to match your /api/profile?email=... pattern

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  // Surface success/cancel messages from Stripe redirects
  useEffect(() => {
    const ok = search?.get("success");
    const canceled = search?.get("canceled");
    if (ok === "1") setNotice("Payment successful. Your subscription is active or will start shortly.");
    if (canceled === "1") setNotice("Payment was cancelled. No changes made.");
  }, [search]);

  // Load profile (align with your Profile page: pass ?email=...)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!authed || !email) return;
      try {
        const r = await fetch(`/api/profile?email=${encodeURIComponent(email)}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Failed to load profile");
        if (mounted) setProfile(j?.profile || j || null); // support either shape
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load profile");
      }
    })();
    return () => { mounted = false; };
  }, [authed, email]);

  // Load invoices/receipts (server route still uses session; keep as-is)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!authed) return;
      try {
        const r = await fetch("/api/billing/invoices?limit=10");
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Failed to load invoices");
        if (mounted) setInvoices(Array.isArray(j?.invoices) ? j.invoices : []);
      } catch {
        if (mounted) setInvoices([]);
      }
    })();
    return () => { mounted = false; };
  }, [authed]);

  const statusText = useMemo(() => (profile?.subscription_status || "none").toLowerCase(), [profile?.subscription_status]);
  const isActive = statusText === "active";
  const isTrial = statusText === "trialing";
  const isLocked = !isActive && !isTrial;
  const rem = daysLeft(profile?.trial_end);
  const displayName = profile?.name || session?.user?.name || profile?.email || "Your Account";
  const displayImage = profile?.image || session?.user?.image || "/default-avatar.png";

  async function startTrial() {
    setBusy(true); setError(null);
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
    setBusy(true); setError(null);
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
      <Head><title>BXKR • Billing</title></Head>

      <main className="container" style={{ paddingBottom: 90, minHeight: "80vh" }}>
        {/* HERO CARD */}
        <section className="bxkr-card bxkr-hero mb-3">
          <div className="identity">
            <img src={displayImage} alt="Account" />
            <div style={{ flex: 1 }}>
              <div className="d-flex align-items-center justify-content-between flex-wrap" style={{ gap: 8 }}>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 700 }}>{displayName}</h4>
                  <div className="text-dim" style={{ fontSize: 13 }}>{profile?.email || session?.user?.email || ""}</div>
                </div>
                <div>
                  <span className={`bxkr-status-pill bxkr-status-${statusText}`}>
                    {isActive ? "Active"
                      : isTrial ? (typeof rem === "number" ? `Trialing • ${rem > 0 ? `${rem} day${rem === 1 ? "" : "s"} left` : "ends today"}` : "Trialing")
                      : statusText.replace("_", " ")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="actions">
            {isActive && (
              <button className="btn-bxkr" onClick={openPortal} disabled={busy || !authed}>Manage Billing</button>
            )}
            {isTrial && (
              <button className="btn-bxkr" onClick={openPortal} disabled={busy || !authed}>Manage Billing</button>
            )}
            {isLocked && (
              <>
                <button className="btn-bxkr-outline" onClick={startTrial} disabled={busy || !authed}>Start 14‑day Trial</button>
                <button className="btn-bxkr-outline" onClick={() => router.push("/paywall")} disabled={busy || !authed}>Upgrade to Premium</button>
                <button className="btn-bxkr" onClick={openPortal} disabled={busy || !authed}>Manage Billing</button>
              </>
            )}
          </div>

          {notice && <div className="alert alert-info mt-2">{notice}</div>}
          {error && <div className="alert alert-danger mt-2">{error}</div>}
          {!authed && <div className="alert alert-warning mt-2">Please sign in to view billing.</div>}
        </section>

        {/* INVOICES CARD */}
        <section className="bxkr-card p-3">
          <h5 className="mb-2">Payments & Receipts</h5>
          {!authed ? (
            <div className="text-dim">Sign in to view receipts.</div>
          ) : invoices === null ? (
            <div className="text-dim">Loading invoices…</div>
          ) : invoices.length === 0 ? (
            <div className="text-dim">No invoices found yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="bxkr-table">
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
                      <td style={{ textTransform: "capitalize" }}>{inv.status || "-"}</td>
                      <td>
                        {inv.receipt_url ? (
                          <a href={inv.receipt_url} target="_blank" rel="noreferrer">View receipt</a>
                        ) : inv.hosted_invoice_url ? (
                          <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer">View invoice</a>
                        ) : inv.invoice_pdf ? (
                          <a href={inv.invoice_pdf} target="_blank" rel="noreferrer">Invoice PDF</a>
                        ) : (
                          <span className="text-dim">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <BottomNav />
    </>
  );
}
