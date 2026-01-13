
import Head from "next/head";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

export default function Register() {
  const { status, data } = useSession();
  const router = useRouter();
  const ACCENT = "#FF8A2A";

  // Redirect authenticated users to onboarding (as you had)
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/onboarding");
    }
  }, [status, router]);

  // Email magic link state
  const [email, setEmail] = useState("");
  const [busyEmail, setBusyEmail] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Iron Acre member code state
  const [showMember, setShowMember] = useState(false);
  const [memberCode, setMemberCode] = useState("");
  const [busyMember, setBusyMember] = useState(false);
  const [memberMsg, setMemberMsg] = useState<string | null>(null);

  function isValidEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSent(false);

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setBusyEmail(true);
    try {
      // NextAuth v4 magic link (Email provider must be configured)
      const res = await signIn("email", {
        email,
        callbackUrl: "/onboarding",
        redirect: false,
      });
      if (res && !res.error) {
        setSent(true);
      } else {
        setError(res?.error || "Something went wrong sending your magic link.");
      }
    } catch {
      setError("Failed to send magic link. Please try again.");
    } finally {
      setBusyEmail(false);
    }
  }

  async function verifyMemberCode() {
    setMemberMsg(null);
    setBusyMember(true);
    try {
      // If not authenticated yet, ask user to sign in first (Google or Magic link).
      // The endpoint trusts the session email; if unauthenticated, it will 401.
      const res = await fetch("/api/membership/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: memberCode }),
      });
      const j = await res.json();
      if (!res.ok) {
        setMemberMsg(j?.error || "Failed to verify code.");
        return;
      }
      setMemberMsg("Membership applied. You now have Premium via Iron Acre Gym.");
      // After success, go straight to onboarding/dashboard
      router.replace("/onboarding");
    } catch (e: any) {
      setMemberMsg("Failed to verify code. Please try again.");
    } finally {
      setBusyMember(false);
    }
  }

  return (
    <>
      <Head>
        <title>Sign in • BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container py-4" style={{ paddingBottom: 80, color: "#fff" }}>
        {/* Top: logo only, ultra simple */}
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center gap-2">
            <img
              src="/BXKRLogoNoBG.jpg"
              alt="BXKR"
              height={34}
              style={{ borderRadius: 8, display: "block" }}
            />
          </div>
          <Link href="/" className="btn-bxkr-outline">Back</Link>
        </div>

        {/* Minimal hero/heading */}
        <section className="mb-3">
          <h1 className="fw-bold" style={{ fontSize: "1.8rem", lineHeight: 1.2 }}>
            Welcome to <span style={{ color: ACCENT }}>BXKR</span>
          </h1>
          <p className="text-dim mt-2 mb-0">
            Sign in with Google or a one‑tap magic link. Gym members can add their code to unlock Premium.
          </p>
        </section>

        {/* Simple sign-in block */}
        <section className="futuristic-card p-3 mb-3">
          <div className="d-grid gap-2">
            <button
              className="bxkr-btn"
              onClick={() => signIn("google", { callbackUrl: "/onboarding" })}
              disabled={status === "loading"}
            >
              Continue with Google
            </button>
            <div className="text-center text-dim small">or</div>

            {/* Magic link email form */}
            <form onSubmit={submitEmail} className="d-grid gap-2">
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
                required
              />
              <button type="submit" className="bxkr-btn" disabled={busyEmail}>
                {busyEmail ? "Sending…" : "Send Magic Link"}
              </button>
              {error && (
                <div className="alert alert-danger mt-1" role="alert">
                  {error}
                </div>
              )}
              {sent && (
                <div className="pill-success mt-1" aria-live="polite">
                  <i className="fa fa-check" aria-hidden="true" /> Magic link sent — check your inbox.
                </div>
              )}
            </form>
          </div>
        </section>

        {/* Iron Acre member block (toggle) */}
        <section className="futuristic-card p-3 mb-3">
          <div className="d-flex justify-content-between align-items-center">
            <div className="fw-semibold">Iron Acre Gym member?</div>
            <button
              className="btn-bxkr-outline"
              onClick={() => setShowMember((s) => !s)}
              aria-expanded={showMember}
              aria-controls="member-panel"
            >
              {showMember ? "Hide" : "Enter Code"}
            </button>
          </div>

          {showMember && (
            <div id="member-panel" className="mt-3">
              {/* If user is not signed in yet, nudge them to sign in first */}
              {status !== "authenticated" ? (
                <div className="text-dim small mb-2">
                  Sign in with Google or a magic link first, then enter your member code to unlock Premium.
                </div>
              ) : (
                <div className="text-dim small mb-2">
                  Signed in as <strong>{data?.user?.email}</strong>. Enter your code to unlock Premium via Iron Acre Gym.
                </div>
              )}

              <div className="d-flex gap-2">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Member code"
                  value={memberCode}
                  onChange={(e) => setMemberCode(e.target.value)}
                  aria-label="Iron Acre member code"
                />
                <button
                  className="bxkr-btn"
                  onClick={verifyMemberCode}
                  disabled={busyMember || status !== "authenticated" || !memberCode.trim()}
                >
                  {busyMember ? "Checking…" : "Apply"}
                </button>
              </div>
              {memberMsg && (
                <div
                  className={`mt-2 ${memberMsg.toLowerCase().includes("fail") || memberMsg.toLowerCase().includes("invalid")
                    ? "alert alert-danger"
                    : "pill-success"}`}
                  role="status"
                  aria-live="polite"
                >
                  {memberMsg}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Footer links */}
        <footer className="text-center text-dim small">
          © {new Date().getFullYear()} BXKR · <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/terms">Terms</Link>
        </footer>
      </main>
    </>
  );
}
