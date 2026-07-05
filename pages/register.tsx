// pages/register.tsx
"use client";

import Head from "next/head";
import Image from "next/image";
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
    if (queryCallbackUrl) return queryCallbackUrl;
    return "/";
  }, [queryCallbackUrl]);

  const gymIdToJoin = useMemo(() => {
    if (queryGymId) return queryGymId;
    return "g1";
  }, [queryGymId]);

  useEffect(() => {
    if (!mounted) return;

    if (queryRef && typeof window !== "undefined") {
      localStorage.setItem("iron_acre_ref", queryRef);
      localStorage.setItem("bxkr_ref", queryRef);
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("app_brand", "iron-acre");
      localStorage.setItem("post_login_callback", callbackUrl);
      localStorage.setItem("pending_gym_id", gymIdToJoin);
    }
  }, [mounted, queryRef, callbackUrl, gymIdToJoin]);

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
        <title>Join Iron Acre Gym</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="Join Iron Acre Gym and access your training, nutrition, progress tracking and member dashboard."
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
          /
            /IronAcreLogoNoBG.png

            <span className="fw-bold">Iron Acre</span>
          </Link>

          /
            Back
          </Link>
        </header>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-kicker">
            <i className="fas fa-fire" />
            start here
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
            Join{" "}
            <span
              style={{
                color: "var(--ia-neon)",
                textShadow: "0 0 18px rgba(24,255,154,0.18)",
              }}
            >
              Iron Acre
            </span>
          </h1>

          <p className="ia-page-subtitle mt-2">
            Create your account to access training, class updates, onboarding, nutrition targets and
            your Iron Acre member dashboard.
          </p>

          <div className="ia-stats-row mt-3">
            <div className="ia-stat">
              <div className="ia-stat-value">
                <i className="fas fa-dumbbell" />
              </div>
              <div className="ia-stat-label">Train</div>
            </div>

            <div className="ia-stat">
              <div className="ia-stat-value">
                <i className="fas fa-chart-line" />
              </div>
              <div className="ia-stat-label">Track</div>
            </div>

            <div className="ia-stat">
              <div className="ia-stat-value">
                <i className="fas fa-fire" />
              </div>
              <div className="ia-stat-label">Progress</div>
            </div>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-card-title-compact">Create your account</div>

          <div className="text-dim small mt-1">
            Continue with Google or use a secure magic link. After sign-in, we’ll take you through
            the right onboarding flow.
          </div>

          <div className="d-grid gap-2 mt-3">
            <button
              type="button"
              className="ia-btn ia-btn-primary w-100"
              onClick={handleGoogleSignIn}
              disabled={status === "loading" || linkingGym}
              style={{
                minHeight: 44,
              }}
            >
              <i className="fab fa-google" />
              {linkingGym ? "Preparing your gym account..." : "Continue with Google"}
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
                {busyEmail ? "Sending magic link..." : "Send magic link"}
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
                Magic link sent — check your inbox.
              </div>
            ) : null}
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-kicker">
            <i className="fas fa-clipboard-check" />
            what happens next
          </div>

          <div className="d-grid gap-2 mt-3">
            <div className="ia-task-card ia-task-card--highlight">
              <div className="ia-task-card__main">
                <div className="ia-task-card__title">Complete onboarding</div>
                <div className="ia-task-card__subtitle">
                  Set goals, training preferences, metrics and programme access.
                </div>
              </div>
              <div className="ia-task-card__aside">
                <span className="ia-badge ia-badge-neon">Step 1</span>
              </div>
            </div>

            <div className="ia-task-card">
              <div className="ia-task-card__main">
                <div className="ia-task-card__title">Complete PAR-Q if joining the gym</div>
                <div className="ia-task-card__subtitle">
                  Required before attending sessions at Iron Acre Gym.
                </div>
              </div>
              <div className="ia-task-card__aside">
                <span className="ia-badge">Step 2</span>
              </div>
            </div>

            <div className="ia-task-card">
              <div className="ia-task-card__main">
                <div className="ia-task-card__title">Start training</div>
                <div className="ia-task-card__subtitle">
                  Access workouts, habits, nutrition tools and progress tracking.
                </div>
              </div>
              <div className="ia-task-card__aside">
                <span className="ia-badge">Step 3</span>
              </div>
            </div>
          </div>
        </section>

        <footer className="text-center small text-dim mt-4">
          © {new Date().getFullYear()} Iron Acre Gym · /privacyPrivacy</Link> ·{" "}
          /termsTerms</Link>
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
