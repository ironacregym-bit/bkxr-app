"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

type Profile = {
  email?: string;
  subscription_status?: string | null; // active|trialing|past_due|paused|canceled|...
  is_premium?: boolean;
  trial_end?: string | null;
  membership_status?: string | null;   // "expired"|...
};

const ACCENT = "#FF8A2A";

function hasTrialExpired(iso?: string | null) {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return Date.now() >= t;
}

export default function BillingTrialBanner() {
  const { data: session } = useSession();
  const email = session?.user?.email || "";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!email) return;
      try {
        const r = await fetch(`/api/profile?email=${encodeURIComponent(email)}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Failed to load profile");
        if (mounted) setProfile(j?.profile || j || null);
      } catch {
        if (mounted) setProfile(null);
      }
    })();
    return () => { mounted = false; };
  }, [email]);

  const showBanner = useMemo(() => {
    if (!profile) return false;
    const status = (profile.subscription_status || "none").toLowerCase();
    const expiredFlag = (profile.membership_status || "").toLowerCase() === "expired";
    const notPremium = profile.is_premium === false;
    return notPremium && (expiredFlag || status !== "trialing" || hasTrialExpired(profile.trial_end));
  }, [profile]);

  async function goCheckout() {
    try {
      setBusy(true);
      const res = await fetch("/api/billing/create-checkout-session", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to create session");
      if (j?.url) window.location.href = j.url;
    } catch {
      // swallow UI error; banner remains
    } finally {
      setBusy(false);
    }
  }

  if (!showBanner) return null;

  return (
    <div
      role="region"
      aria-label="Trial expired banner"
      className="w-100"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 4000,
        padding: "10px 12px",
        background: "rgba(15, 15, 20, 0.9)",
        borderBottom: `1px solid ${ACCENT}`,
        boxShadow: `0 0 12px ${ACCENT}55`,
        backdropFilter: "blur(6px)",
        color: "#fff",
      }}
    >
      <div className="container d-flex justify-content-between align-items-center" style={{ gap: 12 }}>
        <div style={{ fontWeight: 700 }}>
          Your trial has expired — upgrade now to unlock all features.
        </div>
        <button
          className="btn btn-sm"
          style={{
            borderRadius: 24,
            border: `1px solid ${ACCENT}`,
            color: ACCENT,
            background: "transparent",
            boxShadow: `0 0 10px ${ACCENT}55`,
            minWidth: 120,
          }}
          onClick={goCheckout}
          disabled={busy}
        >
          {busy ? "Opening…" : "Upgrade"}
        </button>
      </div>
    </div>
  );
}
