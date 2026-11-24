
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
};

function daysLeft(iso?: string | null) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = Math.ceil((t - Date.now()) / (1000 * 60 * 60 * 24));
  return d;
}

export default function Billing() {
  const { status } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authed = status === "authenticated";

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!authed) return;
      try {
        const r = await fetch("/api/profile");
        const j = await r.json();
        if (mounted) {
          if (!r.ok) throw new Error(j?.error || "Failed to load profile");
          setProfile(j?.profile || null);
        }
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load profile");
      }
    })();
    return () => {
      mounted = false;
    };
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
      <Head>
        <title>Billing • BXKR</title>
      </Head>

      <main className="container py-4" style={{ paddingBottom: 80, color: "#fff" }}>
        <h2 className="mb-3">Billing</h2>
        <p className="text-dim">Manage your subscription and payment method securely via Stripe.</p>

        <div className="futuristic-card p-3 mb-3">
          {!authed ? (
            <div className="text-muted">Sign in to view billing options.</div>
          ) : !profile ? (
            <div className="text-muted">Loading your subscription…</div>
          ) : (
            <>
              {isActive && (
                <>
                  <div className="mb-2"><strong>Status:</strong> Active (Premium)</div>
                  <div className="d-flex gap-2 flex-wrap">
                    <button className="bxkr-btn" onClick={openPortal} disabled={busy}>
                      Manage Billing (Stripe Portal)
                    </button>
                  </div>
                </>
              )}

              {isTrial && (
                <>
                  <div className="mb-2">
                    <strong>Status:</strong> Trialing{" "}
                    {typeof rem === "number" && (
                      <span className="text-muted">
                        • {rem > 0 ? `ends in ${rem} day${rem === 1 ? "" : "s"}` : "ends today"}
                      </span>
                    )}
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <button className="bxkr-btn" onClick={openPortal} disabled={busy}>
                      Manage Billing (Stripe Portal)
                    </button>
                  </div>
                </>
              )}

              {isLocked && (
                <>
                  <div className="mb-2">
                    <strong>Status:</strong> {statusText.replace("_", " ")}
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <button className="btn-bxkr-outline" onClick={startTrial} disabled={busy}>
                      Start 14‑day Trial
                    </button>
                    <button className="bxkr-btn" onClick={openPortal} disabled={busy}>
                      Manage Billing (Stripe Portal)
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {error && <div className="alert alert-danger mt-3">{error}</div>}
        </div>
      </main>
    </>
  );
}
