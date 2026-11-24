
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function ParqSuccessPage() {
  const ACCENT = "#FF8A2A";
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const linked = mounted && router.query.linked === "1";
  const registerHref =
    (mounted && typeof router.query.register === "string" && router.query.register) || "/register?parq=ok";

  return (
    <>
      <Head>
        <title>PAR‑Q Submitted • BXKR</title>
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
          <Link href="/" className="btn-bxkr-outline">Home</Link>
        </div>

        <section className="mb-3">
          <h1 className="fw-bold" style={{ fontSize: "1.8rem", lineHeight: 1.2 }}>
            PAR‑Q <span style={{ color: ACCENT }}>received</span>
          </h1>
          <p className="text-dim mt-2 mb-0">
            Thanks — your responses have been recorded.
          </p>
        </section>

        <section className="futuristic-card p-3 mb-3">
          <div className="pill-success mb-2" aria-live="polite">
            <i className="fa fa-check" aria-hidden="true" /> Submitted successfully.
          </div>

          {linked ? (
            <p className="mb-0">Your PAR‑Q is linked to your account.</p>
          ) : (
            <>
              <p className="mb-3">Create an account to link your PAR‑Q and access your training dashboard.</p>
              <div className="d-grid">
                <Link href={registerHref} className="bxkr-btn">
                  Create an account
                </Link>
              </div>
            </>
          )}
        </section>

        <footer className="text-center text-dim small">
          © {new Date().getFullYear()} BXKR · <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/terms">Terms</Link>
        </footer>
      </main>
    </>
  );
}
