
import Head from "next/head";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function Register() {
  const { status } = useSession();
  const router = useRouter();
  const ACCENT = "#FF8A2A";

  // Redirect authenticated users to onboarding
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

  return (
    <>
      <Head>
        <title>Sign in • BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container py-4" style={{ paddingBottom: 80, color: "#fff" }}>
        {/* Top: logo & back */}
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
            Sign in to <span style={{ color: ACCENT }}>register</span> or log in
          </h1>
          <p className="text-dim mt-2 mb-0">
            Continue with Google or request a one‑tap magic link by email. You’ll complete onboarding next.
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

        {/* Footer links */}
        <footer className="text-center text-dim small">
          © {new Date().getFullYear()} BXKR · <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/terms">Terms</Link>
        </footer>
      </main>
    </>
  );
}
