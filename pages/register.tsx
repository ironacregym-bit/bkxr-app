
import Head from "next/head";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

export default function Register() {
  const { status } = useSession();
  const router = useRouter();
  const ACCENT = "#FF8A2A";

  // If already authenticated, go to onboarding
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/onboarding");
    }
  }, [status, router]);

  // In‑person CTA via WhatsApp (replace with your real number if desired)
  // Provide digits only, no "+" or spaces (E.164 without '+')
  const whatsappNumber = "447000000000";
  const waHref = useMemo(() => {
    const msg = encodeURIComponent(
      "Hi — I'd like to try a BXKR class at Iron Acre Gym in Westerfield. Could you share the next available sessions and how to book?"
    );
    return `https://wa.me/${whatsappNumber}?text=${msg}`;
  }, [whatsappNumber]);

  // Email magic link form state
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
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

    setBusy(true);
    try {
      // NextAuth v4: trigger Email provider magic link
      // We set redirect:false so the page doesn’t navigate; user will click the email link.
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
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>Register • BXKR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container py-4" style={{ paddingBottom: 80, color: "#fff" }}>
        {/* Top bar with logo and Google sign-in */}
        <div className="d-flex justify-content-between align-items-center mb-4 futuristic-card">
          <div className="d-flex align-items-center gap-2">
            <img
              src="/BXKRLogoNoBG.jpg"
              alt="BXKR"
              height={34}
              style={{ borderRadius: 8, display: "block" }}
            />
          </div>
          <button
            className="bxkr-btn"
            onClick={() => signIn("google", { callbackUrl: "/onboarding" })}
            disabled={status === "loading"}
          >
            Sign in with Google
          </button>
        </div>

        {/* Hero */}
        <section className="row align-items-center mb-4">
          <div className="col-12 col-lg-7 mb-3">
            <h1 className="fw-bold" style={{ fontSize: "2.2rem", lineHeight: 1.2 }}>
              Join <span style={{ color: ACCENT }}>BXKR</span> — Hybrid Boxing & Kettlebell
            </h1>
            <p className="text-dim mt-2">
              Use a magic link sent to your email or sign in with Google. BXKR blends
              boxing (fitness & technique) with kettlebell functional strength to build
              real conditioning, skill and progression.
            </p>
          </div>
          <div className="col-12 col-lg-5">
            <div className="futuristic-card p-3" style={{ height: "100%" }}>
              <div className="fw-semibold">Prefer In‑Person?</div>
              <p className="small text-dim mb-2">
                Train in the open‑barn gym at Iron Acre (Westerfield). Coach‑led sessions,
                community, and proper work.
              </p>
              <div className="d-flex gap-2 flex-wrap">
                <a href={waHref} target="_blank" rel="noopener noreferrer" className="bxkr-btn">
                  Message us on WhatsApp
                </a>
                <Link href="/" className="btn-bxkr-outline">
                  Back to Landing
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Register card */}
        <section className="futuristic-card p-4 mb-4">
          <div className="fw-semibold mb-2">Email Magic Link</div>
          <p className="small text-dim">
            Enter your email and we’ll send you a secure link to sign in. No passwords — just
            check your inbox and tap the link.
          </p>

          <form className="mt-2" onSubmit={submitEmail}>
            <div className="row g-2 align-items-end">
              <div className="col-12 col-md-8">
                <label className="form-label">Email address</label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="col-12 col-md-4 d-flex gap-2">
                <button type="submit" className="bxkr-btn" disabled={busy}>
                  {busy ? "Sending…" : "Send Magic Link"}
                </button>
                <button
                  type="button"
                  className="btn-bxkr-outline"
                  onClick={() => signIn("google", { callbackUrl: "/onboarding" })}
                >
                  Google
                </button>
              </div>
            </div>

            {error && (
              <div className="alert alert-danger mt-3" role="alert">
                {error}
              </div>
            )}
            {sent && (
              <div className="pill-success mt-3">
                <i className="fa fa-check" aria-hidden="true" />
                Magic link sent — check your inbox.
              </div>
            )}
          </form>
        </section>

        {/* What you get */}
        <section className="futuristic-card p-4 mb-4">
          <div className="fw-semibold mb-2">BXKR Online — What’s included</div>
          <ul className="small text-dim mt-1">
            <li>10‑round structured sessions (Boxing 1–5, Kettlebells 6–10)</li>
            <li>Habit tracking and daily check‑off</li>
            <li>Nutrition logging with barcode scanner</li>
            <li>Weekly overview, streaks & micro‑stats</li>
            <li>Scheduling & class booking</li>
            <li>Push notification accountability</li>
            <li>Founders pricing: <strong>£20/month</strong></li>
          </ul>
        </section>

        {/* Footer */}
        <footer className="text-center text-dim small">
          © {new Date().getFullYear()} BXKR · <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/terms">Terms</Link>
        </footer>
      </main>
    </>
  );
}
