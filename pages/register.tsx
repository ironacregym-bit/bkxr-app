// pages/register.tsx
import Head from "next/head";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

type Brand = "bxkr" | "iron-acre";

function resolveBrandFromHost(host?: string | null): Brand {
  const h = String(host || "").toLowerCase();
  if (h.includes("ironacregym")) return "iron-acre";
  return "bxkr";
}

function normaliseQueryString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

export default function Register() {
  const { status } = useSession();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [busyEmail, setBusyEmail] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkingGym, setLinkingGym] = useState(false);

  const didRedirectRef = useRef(false);

  useEffect(() => setMounted(true), []);

  const queryBrand = normaliseQueryString(router.query.brand).toLowerCase();
  const queryGymId = normaliseQueryString(router.query.gym_id);
  const queryCallbackUrl = normaliseQueryString(router.query.callbackUrl);

  const brand: Brand = useMemo(() => {
    if (!mounted) return "bxkr";

    const host = typeof window !== "undefined" ? window.location.host : "";
    const hostBrand = resolveBrandFromHost(host);

    if (queryBrand === "iron-acre") return "iron-acre";
    if (queryGymId === "g1") return "iron-acre";
    if (queryCallbackUrl.startsWith("/iron-acre")) return "iron-acre";

    return hostBrand;
  }, [mounted, queryBrand, queryGymId, queryCallbackUrl]);

  const isIronAcre = brand === "iron-acre";

  const ACCENT = isIronAcre ? "#24FFA0" : "#FF8A2A";
  const ACCENT_SOFT = isIronAcre ? "rgba(36,255,160,0.18)" : "rgba(255,138,42,0.18)";
  const SURFACE = isIronAcre ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.05)";
  const BORDER = isIronAcre ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(255,255,255,0.08)";
  const brandName = isIronAcre ? "Iron Acre Gym" : "BXKR";
  const logoSrc = isIronAcre ? "/IronAcreLogoNoBG.jpg" : "/BXKRLogoNoBG.jpg";
  const defaultAfterLogin = isIronAcre ? "/iron-acre" : "/";

  const callbackUrl = useMemo(() => {
    if (queryCallbackUrl) return queryCallbackUrl;
    return defaultAfterLogin;
  }, [queryCallbackUrl, defaultAfterLogin]);

  const gymIdToJoin = useMemo(() => {
    if (queryGymId) return queryGymId;
    if (isIronAcre) return "g1";
    return "";
  }, [queryGymId, isIronAcre]);

  const showParqBanner = mounted && router.query.parq === "ok";

  useEffect(() => {
    if (!mounted) return;

    const ref = normaliseQueryString(router.query.ref);
    if (ref && typeof window !== "undefined") {
      localStorage.setItem("bxkr_ref", ref);
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("app_brand", brand);
      localStorage.setItem("post_login_callback", callbackUrl);

      if (gymIdToJoin) {
        localStorage.setItem("pending_gym_id", gymIdToJoin);
      } else {
        localStorage.removeItem("pending_gym_id");
      }
    }
  }, [mounted, router.query.ref, brand, callbackUrl, gymIdToJoin]);

  useEffect(() => {
    if (!mounted) return;
    if (status !== "authenticated") return;
    if (didRedirectRef.current) return;

    const run = async () => {
      didRedirectRef.current = true;

      try {
        if (isIronAcre && gymIdToJoin) {
          setLinkingGym(true);

          await fetch("/api/profile/join-gym", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gym_id: gymIdToJoin }),
          }).catch(() => null);
        }
      } finally {
        setLinkingGym(false);
        router.replace(callbackUrl);
      }
    };

    run().catch(() => {
      router.replace(callbackUrl);
    });
  }, [mounted, status, isIronAcre, gymIdToJoin, callbackUrl, router]);

  function isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

  const backButtonClass = isIronAcre ? "ia-btn-outline" : "btn-bxkr-outline";
  const primaryButtonClass = isIronAcre ? "ia-btn" : "bxkr-btn";

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
              height={38}
              style={{ borderRadius: 10, display: "block" }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/BXKRLogoNoBG.jpg";
              }}
            />
          </div>

          <Link href={defaultAfterLogin} className={backButtonClass}>
            Back
          </Link>
        </div>

        {showParqBanner && (
          <div
            className="mb-3"
            aria-live="polite"
            style={{
              borderRadius: 999,
              padding: "10px 14px",
              background: ACCENT_SOFT,
              color: ACCENT,
              border: `1px solid ${ACCENT_SOFT}`,
              fontWeight: 700,
              fontSize: ".92rem",
            }}
          >
            <i className="fa fa-check" aria-hidden="true" /> PAR-Q received — create your account to link it.
          </div>
        )}

        <section className="mb-3">
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
              borderRadius: 999,
              padding: "7px 12px",
              background: ACCENT_SOFT,
              border: `1px solid ${ACCENT_SOFT}`,
              color: ACCENT,
              fontSize: ".78rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {isIronAcre ? "Iron Acre Gym login" : "Account access"}
          </div>

          <h1 className="fw-bold" style={{ fontSize: "2rem", lineHeight: 1.1, marginBottom: 10 }}>
            {isIronAcre ? (
              <>
                Sign in to your <span style={{ color: ACCENT }}>Iron Acre</span> gym account
              </>
            ) : (
              <>
                Sign in to <span style={{ color: ACCENT }}>BXKR</span>
              </>
            )}
          </h1>

          <p className="text-dim mb-0" style={{ maxWidth: 680 }}>
            {isIronAcre ? (
              <>
                Continue with Google or request a magic link. If you came through the Iron Acre gym login, your account
                will be linked to the gym automatically and you will land in your performance dashboard.
              </>
            ) : (
              <>
                Continue with Google or request a one-tap magic link by email. You’ll be able to log straight in.
              </>
            )}
          </p>
        </section>

        <section
          className={isIronAcre ? "ia-tile ia-tile-pad mb-3" : "futuristic-card p-3 mb-3"}
          style={
            isIronAcre
              ? undefined
              : {
                  background: SURFACE,
                  border: BORDER,
                  borderRadius: 20,
                }
          }
        >
          <div className="d-grid gap-2">
            <button
              className={primaryButtonClass}
              onClick={() => signIn("google", { callbackUrl })}
              disabled={status === "loading" || linkingGym}
              style={
                isIronAcre
                  ? undefined
                  : {
                      borderRadius: 999,
                    }
              }
            >
              {linkingGym ? "Preparing your gym login..." : "Continue with Google"}
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
                style={{
                  minHeight: 48,
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#fff",
                }}
              />

              <button
                type="submit"
                className={primaryButtonClass}
                disabled={busyEmail || linkingGym}
                style={
                  isIronAcre
                    ? undefined
                    : {
                        borderRadius: 999,
                      }
                }
              >
                {busyEmail ? "Sending…" : "Send magic link"}
              </button>

              {error && (
                <div className="alert alert-danger mt-1" role="alert">
                  {error}
                </div>
              )}

              {sent && (
                <div
                  className="mt-1"
                  aria-live="polite"
                  style={{
                    borderRadius: 14,
                    padding: "10px 12px",
                    background: ACCENT_SOFT,
                    color: ACCENT,
                    border: `1px solid ${ACCENT_SOFT}`,
                    fontWeight: 600,
                  }}
                >
                  <i className="fa fa-check" aria-hidden="true" /> Magic link sent — check your inbox.
                </div>
              )}
            </form>

            <div className="text-dim small mt-2">
              You will be redirected to{" "}
              <span className="fw-semibold" style={{ color: ACCENT }}>
                {callbackUrl}
              </span>
              {gymIdToJoin ? (
                <>
                  {" "}
                  and linked to gym{" "}
                  <span className="fw-semibold" style={{ color: ACCENT }}>
                    {gymIdToJoin}
                  </span>
                  .
                </>
              ) : (
                "."
              )}
            </div>
          </div>
        </section>

        {isIronAcre && (
          <section
            className="mb-3"
            style={{
              borderRadius: 20,
              padding: 16,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="ia-kicker mb-2" style={{ color: ACCENT }}>
              IRON ACRE ACCESS
            </div>

            <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 6 }}>
              Coming in through the gym login?
            </div>

            <div className="text-dim small" style={{ lineHeight: 1.5 }}>
              This route can be used for gym-first sign-up and sign-in. If you send people through the Iron Acre login
              link, they can be automatically attached to the gym and taken straight into the Iron Acre dashboard after
              authentication.
            </div>
          </section>
        )}

        <footer className="text-center text-dim small">
          © {new Date().getFullYear()} {brandName} · <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/terms">Terms</Link>
        </footer>
      </main>
    </>
  );
}
