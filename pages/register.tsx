// pages/register.tsx
import Head from "next/head";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

type Brand = "bxkr" | "iron-acre";

function resolveBrandFromHost(host?: string | null): Brand {
  const h = String(host || "").toLowerCase();
  if (h.includes("ironacregym")) return "iron-acre";
  return "bxkr";
}

export default function Register() {
  const { status } = useSession();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Brand detection (client-side host)
  const brand: Brand = useMemo(() => {
    if (!mounted) return "bxkr";
    const host = typeof window !== "undefined" ? window.location.host : "";
    return resolveBrandFromHost(host);
  }, [mounted]);

  const isIronAcre = brand === "iron-acre";

  // Brand-specific UI tokens
  const ACCENT = isIronAcre ? "#22c55e" : "#FF8A2A";
  const brandName = isIronAcre ? "Iron Acre Gym" : "BXKR";
  const logoSrc = isIronAcre ? "/IronAcreLogoNoBG.jpg" : "/BXKRLogoNoBG.jpg"; // change if your Iron Acre logo filename differs
  const defaultAfterLogin = isIronAcre ? "/iron-acre" : "/";

  // Respect callbackUrl if provided (NextAuth passes this)
  const callbackUrl = useMemo(() => {
    const q = router.query.callbackUrl;
    if (typeof q === "string" && q.trim()) return q;
    return defaultAfterLogin;
  }, [router.query.callbackUrl, defaultAfterLogin]);

  // If authed, go where you should go for this brand/callback
  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  const showParqBanner = mounted && router.query.parq === "ok";

  // Persist ?ref= to localStorage for later capture
  useEffect(() => {
    if (!mounted) return;
    const ref = (router.query.ref as string) || "";
    if (ref && typeof window !== "undefined") {
      localStorage.setItem("bxkr_ref", ref);
    }
  }, [mounted, router.query.ref]);

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
        callbackUrl,
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
        <title>Sign in • {brandName}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container py-4" style={{ paddingBottom: 80, color: "#fff" }}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center gap-2">
            <img
              src={logoSrc}
              alt={brandName}
              height={34}
              style={{ borderRadius: 8, display: "block" }}
              onError={(e) => {
                // Fallback if Iron Acre logo path isn't there yet
                (e.currentTarget as HTMLImageElement).src = "/BXKRLogoNoBG.jpg";
              }}
            />
          </div>

          {/* Back should return to correct home for that brand */}
          <Link href={defaultAfterLogin} className="btn-bxkr-outline">
            Back
          </Link>
        </div>

        {showParqBanner && (
          <div className="pill-success mb-3" aria-live="polite">
            <i className="fa fa-check" aria-hidden="true" /> PAR‑Q received — create your account to link it.
          </div>
        )}

        <section className="mb-3">
          <h1 className="fw-bold" style={{ fontSize: "1.8rem", lineHeight: 1.2 }}>
            Sign in to{" "}
            <span style={{ color: ACCENT }}>
              {isIronAcre ? "track your gym progress" : "register"}
            </span>{" "}
            or log in
          </h1>

          <p className="text-dim mt-2 mb-0">
            {isIronAcre ? (
              <>
                Continue with Google or request a magic link. You will land in your Iron Acre performance dashboard.
              </>
            ) : (
              <>
                Continue with Google or request a one‑tap magic link by email. You’ll be able to log straight in.
              </>
            )}
          </p>
        </section>

        <section className="futuristic-card p-3 mb-3">
          <div className="d-grid gap-2">
            <button
              className="bxkr-btn"
              onClick={() => signIn("google", { callbackUrl })}
              disabled={status === "loading"}
            >
              Continue with Google
            </button>

            <div className="text-center text-dim small">or</div>

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

            {/* Helpful hint about where they will land */}
            <div className="text-dim small mt-2">
              You will be redirected to{" "}
              <span className="fw-semibold" style={{ color: ACCENT }}>
                {callbackUrl}
              </span>
              .
            </div>
          </div>
        </section>

        <footer className="text-center text-dim small">
          © {new Date().getFullYear()} {brandName} · <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/terms">Terms</Link>
        </footer>
      </main>
    </>
  );
}
