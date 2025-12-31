
// pages/billing/index.tsx
import Head from "next/head";
import { useSession } from "next-auth/react";
import { useState } from "react";

export default function Billing() {
  const { status } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startTrial() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/create-checkout-session", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to create session");
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
        <p className="text-dim">
          Manage your subscription and payment method securely via Stripe.
        </p>

        <div className="futuristic-card p-3 mb-3">
          <div className="d-flex gap-2 flex-wrap">
            <button className="bxkr-btn" onClick={openPortal} disabled={busy || status !== "authenticated"}>
              Manage Billing (Stripe Portal)
            </button>
            <button className="btn-bxkr-outline" onClick={startTrial} disabled={busy || status !== "authenticated"}>
              Start 14‑day Trial
            </button>
          </div>
          {error && <div className="alert alert-danger mt-3">{error}</div>}
        </div>
      </main>
    </>
  );
}
