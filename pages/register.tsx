// pages/register.tsx
"use client";

import Head from "next/head";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

function normaliseQueryString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function safeCallbackUrl(value: string) {
  const cleaned = String(value || "").trim();

  if (!cleaned) return "/";
  if (cleaned.startsWith("/")) return cleaned;

  return "/";
}

export default function RegisterPage() {
  const router = useRouter();
  const { status } = useSession();

  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [busyEmail, setBusyEmail] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkingGym, setLinkingGym] = useState(false);

  const didRedirectRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const queryCallbackUrl = normaliseQueryString(router.query.callbackUrl);
  const queryGymId = normaliseQueryString(router.query.gym_id);
  const queryRef = normaliseQueryString(router.query.ref);

  const callbackUrl = useMemo(() => {
    return safeCallbackUrl(queryCallbackUrl || "/");
  }, [queryCallbackUrl]);

  const gymIdToJoin = useMemo(() => {
    return queryGymId || "g1";
  }, [queryGymId]);

  useEffect(() => {
    if (!mounted) return;
    if (typeof window === "undefined") return;

    localStorage.setItem("app_brand", "iron-acre");
    localStorage.setItem("post_login_callback", callbackUrl);
    localStorage.setItem("pending_gym_id", gymIdToJoin);

    if (queryRef) {
      localStorage.setItem("iron_acre_ref", queryRef);
      localStorage.setItem("bxkr_ref", queryRef);
    }
  }, [mounted, callbackUrl, gymIdToJoin, queryRef]);

  useEffect(() => {
    if (!mounted) return;
    if (status !== "authenticated") return;
    if (didRedirectRef.current) return;

    const run = async () => {
      didRedirectRef.current = true;

      try {
        if (gymIdToJoin) {
          setLinkingGym(true);

          await fetch("/api/profile/join-gym", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              gym_id: gymIdToJoin,
            }),
          }).catch(() => null);
        }
      } finally {
        setLinkingGym(false);
        router.replace(callbackUrl || "/");
      }
    };

    run().catch(() => {
      router.replace(callbackUrl || "/");
    });
  }, [mounted, status, gymIdToJoin, callbackUrl, router]);

  async function handleGoogleSignIn() {
    setError(null);

    await signIn("google", {
      callbackUrl,
    });
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();

    setError(null);
    setSent(false);

    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setBusyEmail(true);

    try {
      const res = await signIn("email", {
        email: cleanEmail,
        callbackUrl,
        redirect: false,
      });

      if (res && !res.error) {
        setSent(true);
      } else {
        setError(res?.error || "Something went wrong sending your sign-in link.");
      }
    } catch {
      setError("Failed to send sign-in link. Please try again.");
    } finally {
      setBusyEmail(false);
    }
  }

  const loading = status === "loading" || linkingGym;

  return (
    <>
      <Head>
        <title>Sign in • Iron Acre Gym</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="Sign in to Iron Acre Gym to access your training, nutrition, progress tracking and member dashboard."
        />
      </Head>

      <main
        className="ia-app container py-4"
        style={{
          minHeight: "100vh",
          paddingBottom: 100,
          color: "#fff",
          background:
            "radial-gradient(circle at top right, rgba(24,255,154,0.12), transparent 34%), linear-gradient(to bottom, #070a0d 0%, #0d1416 55%, #111a16 100%)",
        }}
      >
        <header className="d-flex justify-content-between align-items-center mb-3">
          <Link href="/">
            <img src ="/iron_acre_logo_transparent.png"></img>

            <span className="fw-bold text-white">Iron Acre</span>
          </Link>
        </header>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-kicker">
            <i className="fas fa-fire" />
            member access
          </div>

          <h1
            className="mt-2 mb-0"
            style={{
              fontSize: "2rem",
              lineHeight: 1.05,
              fontWeight: 900,
              letterSpacing: "-0.04em",
            }}
          >
            Sign in to{" "}
            <span
              style={{
                color: "var(--ia-neon)",
                textShadow: "0 0 18px rgba(24,255,154,0.18)",
                whiteSpace: "nowrap",
              }}
            >
              Iron Acre
            </span>
          </h1>

          <p className="ia-page-subtitle mt-2">
            Continue with Google or request a secure sign-in link. Your account is created
            automatically the first time you sign in.
          </p>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-card-title-compact">Member sign in</div>

          <div className="text-dim small mt-1">
            New members will be taken through onboarding after logging in.
          </div>

          <div className="d-grid gap-2 mt-3">
            <button
              type="button"
              className="ia-btn ia-btn-primary w-100"
              onClick={handleGoogleSignIn}
              disabled={loading}
              style={{
                minHeight: 44,
              }}
            >
              <i className="fab fa-google" />
              {linkingGym ? "Preparing your account..." : "Continue with Google"}
            </button>

            <div className="text-center text-dim small">or</div>

            <form onSubmit={submitEmail} className="d-grid gap-2">
              <input
                type="email"
                className="form-control ia-form-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
                required
              />

              <button
                type="submit"
                className="ia-btn ia-btn-outline w-100"
                disabled={busyEmail || linkingGym}
                style={{
                  minHeight: 42,
                }}
              >
                <i className="fas fa-envelope" />
                {busyEmail ? "Sending sign-in link..." : "Email me a sign-in link"}
              </button>
            </form>

            {error ? (
              <div className="ia-inline-note-error mt-1" role="alert">
                {error}
              </div>
            ) : null}

            {sent ? (
              <div className="ia-inline-note-success mt-1" aria-live="polite">
                <i className="fas fa-check-circle me-2" />
                Sign-in link sent — check your inbox.
              </div>
            ) : null}
          </div>
        </section>

        <section className="ia-tile ia-tile-pad">
          <div className="ia-kicker">
            <i className="fas fa-route" />
            after sign in
          </div>

          <div className="text-dim small mt-2">
            If your setup is incomplete, Iron Acre will take you straight into onboarding so we can
            set your profile, programme and access correctly.
          </div>
        </section>

        <footer className="text-center small text-dim mt-4">
          © {new Date().getFullYear()} Iron Acre Gym ·{" "}
          /privacyPrivacy</Link> · /termsTerms</Link>
        </footer>

        <style jsx>{`
          .ia-form-input {
            min-height: 48px;
            border-radius: 14px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: rgba(255, 255, 255, 0.04);
            color: #fff;
          }

          .ia-form-input:focus {
            border-color: rgba(24, 255, 154, 0.42);
            box-shadow: 0 0 0 3px rgba(24, 255, 154, 0.12);
            background: rgba(255, 255, 255, 0.05);
            color: #fff;
          }

          .ia-form-input::placeholder {
            color: rgba(255, 255, 255, 0.4);
          }
        `}</style>
      </main>
    </>
  );
}
