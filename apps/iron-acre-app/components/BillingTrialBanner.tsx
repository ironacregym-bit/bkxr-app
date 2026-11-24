"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

type Profile = {
  email?: string;
  subscription_status?: string | null; // active|trialing|past_due|paused|canceled|...
  is_premium?: boolean;
  trial_end?: string | null;
  membership_status?: string | null;   // "expired"|...
};

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
      className="sticky top-0 z-[4000] border-b border-ia-primary bg-ia-bg/90 px-3 py-2.5 text-foreground shadow-sm backdrop-blur-md"
    >
      <div className="container mx-auto flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">
          Your trial has expired — upgrade now to unlock all features.
        </div>
        <Button
          variant="outline"
          size="sm"
          className="min-w-[120px] rounded-full border-ia-primary text-ia-primary hover:bg-ia-primary/10"
          onClick={goCheckout}
          disabled={busy}
        >
          {busy ? "Opening…" : "Upgrade"}
        </Button>
      </div>
    </div>
  );
}
