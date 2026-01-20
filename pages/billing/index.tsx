
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
  // optional (if your /api/profile adds them later)
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

function StatusPill({ status, trialEnd }: { status?: string; trialEnd?: string | null }) {
  const s = (status || "none").toLowerCase();
  const rem = daysLeft(trialEnd || undefined);

  const palette: Record<string, { bg: string; fg: string; label: string }> = {
    active: { bg: "rgba(46,204,113,0.2)", fg: "#2ecc71", label: "Active" },
    trialing: { bg: "rgba(241,196,15,0.2)", fg: "#f1c40f", label: rem != null ? `Trialing • ${rem > 0 ? `${rem} day${rem === 1 ? "" : "s"} left` : "ends today"}` : "Trialing" },
    past_due: { bg: "rgba(231,76,60,0.2)", fg: "#e74c3c", label: "Past due" },
    paused: { bg: "rgba(52,152,219,0.2)", fg: "#3498db", label: "Paused" },
    canceled: { bg: "rgba(149,165,166,0.2)", fg: "#95a5a6", label: "Canceled" },
    trial_ended: { bg: "rgba(149,165,166,0.2)", fg: "#95a5a6", label: "Trial ended" },
    none: { bg: "rgba(149,165,166,0.2)", fg: "#95a5a6", label: "Free tier" },
  };

  const { bg, fg, label } = palette[s] || palette.none;

  return (
    <span
      style={{
        display: "inline-block",
        padding: "6px 12px",
        borderRadius: 20,
        background: bg,
        color: fg,
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: 0.3,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

export default function Billing() {
  const router = useRouter();
  const search = useSearchParams();
  const { status: authStatus, data: session } = useSession();
  const authed = authStatus === "authenticated";

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  // Read success/canceled flags from query (e.g., after returning from Checkout)
  useEffect(() => {
    const ok = search?.get("success");
    const canceled = search?.get("canceled");
    if (ok === "1") setNotice("✅ Payment successful. Your subscription is active or will start shortly.");
    if (canceled === "1") setNotice("Payment cancelled. No changes were made.");
  }, [search]);

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
      } catch {
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

  const displayName = useMemo(() => {
    return profile?.name || session?.user?.name || profile?.email || "Your Account";
  }, [profile?.name, profile?.email, session?.user?.name]);

  const displayImage = useMemo(() => {
    return profile?.image || session?.user?.image || "/default-avatar.png";
  }, [profile?.image, session?.user?.image]);

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
      <Head><title>BXKR • Billing</title></Head>
      <main
        className="container"
        style={{
          paddingTop: 12,
          paddingBottom: 90,
          color: "#fff",
          minHeight: "80vh",
          background: "linear-gradient(135deg, #0b0f14 0%, #1b0f08 45%, #0b0f14 100%)",
          borderRadius: 12,
        }}
      >
        {/* Hero header */}
        <section
          className="mb-3"
          style={{
            background: "radial-gradient(1200px 300px at 10% -10%, rgba(255,138,42,0.15), transparent), rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 16,
            padding: 16,
            boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
          }}
        >
          <div className="d-flex align-items-center gap-3">
            <img
              src={displayImage}
              alt="Account"
              className="rounded-circle border"
              style={{ width: 72, height: 72, objectFit: "cover", borderColor: "rgba(255,255,255,0.25)" }}
            />
            <div className="flex-grow-1">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div>
                  <h4 style={{ margin: 0, fontWeight: 700 }}>{displayName}</h4>
                  <div style={{ opacity: 0.7, fontSize: 13 }}>
                    {profile?.email || session?.user?.email || ""}
                  </div>
                </div>
                <div>
                  <StatusPill status={profile?.subscription_status} trialEnd={profile?.trial_end ?? null} />
                </div>
              </div>
            </div>
          </div>

          <div className="d-flex gap-2 mt-3 flex-wrap">
            {isActive && (
              <button
                className="bxkr-btn"
                onClick={openPortal}
                disabled={busy || !authed}
                style={{
                  borderRadius: 24,
                  background: "linear-gradient(90deg, #ff7f32, #ff9f58)",
                  color: "#0b0f14",
                  fontWeight: 700,
                  border: "none",
                  boxShadow: "0 0 20px rgba(255,127,50,0.45)",
                }}
              >
                Manage Billing
              </button>
            )}
            {isTrial && (
              <button
                className="bxkr-btn"
                onClick={openPortal}
                disabled={busy || !authed}
                style={{
                  borderRadius: 24,
                  background: "linear-gradient(90deg, #ff7f32, #ff9f58)",
                  color: "#0b0f14",
                  fontWeight: 700,
                  border: "none",
                  boxShadow: "0 0 20px rgba(255,127,50,0.45)",
                }}
              >
                Manage Billing
              </button>
            )}
            {isLocked && (
              <>
                <button
                  className="btn-bxkr-outline"
                  onClick={startTrial}
                  disabled={busy || !authed}
                  style={{ borderRadius: 24 }}
                >
                  Start 14‑day Trial
                </button>
                <button
                  className="bxkr-btn"
                  onClick={() => router.push("/paywall")}
                  disabled={busy || !authed}
                  style={{
                    borderRadius: 24,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#fff",
                    fontWeight: 700,
                  }}
                >
                  Upgrade to Premium
                </button>
                <button
                  className="bxkr-btn"
                  onClick={openPortal}
                  disabled={busy || !authed}
                  style={{
                    borderRadius: 24,
                    background: "linear-gradient(90deg, #ff7f32, #ff9f58)",
                    color: "#0b0f14",
                    fontWeight: 700,
                    border: "none",
                    boxShadow: "0 0 20px rgba(255,127,50,0.45)",
                  }}
                >
                  Manage Billing
                </button>
              </>
            )}
          </div>

          {notice && (
            <div className="alert alert-info mt-3" role="status">
              {notice}
            </div>
          )}
          {error && (
            <div className="alert alert-danger mt-3" role="alert">
              {error}
            </div>
          )}
        </section>

        {/* Invoices & receipts */}
        <section
          className="p-3"
          style={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: 16,
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <h5 className="mb-2">Payments & Receipts</h5>

          {!authed ? (
            <div className="alert alert-info">Please sign in to view receipts.</div>
          ) : invoices === null ? (
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
      </main>

      <BottomNav />
    </>
  );
}
