import Head from "next/head";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import { getSession } from "next-auth/react";

export const getServerSideProps: GetServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  const session = await getSession(context);
  if (session) {
    return { redirect: { destination: "/", permanent: false } };
  }
  return { props: {} };
};

export default function Landing() {
  const { status } = useSession();
  const accent = "#ff7f32";

  const glass = {
    background: "rgba(255,255,255,0.05)",
    backdropFilter: "blur(10px)",
    borderRadius: 16,
    boxShadow: "0 8px 30px rgba(0,0,0,.45)",
  } as const;

  return (
    <>
      <Head>
        <title>BXKR — Boxing x Kettlebell Conditioning System</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main
        className="container py-4"
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #121212 0%, #2a160c 100%)",
          color: "#fff",
          paddingBottom: 80,
        }}
      >
        {/* Top bar */}
        <div
          className="d-flex justify-content-between align-items-center mb-4"
          style={{ ...glass, padding: "12px 16px" }}
        >
          <div className="fw-bold">BXKR</div>
          <div className="d-flex gap-2">
            <button
              className="btn btn-sm btn-primary"
              style={{ backgroundColor: accent, border: "none", borderRadius: 24 }}
              onClick={() => signIn("google")}
              disabled={status === "loading"}
            >
              Sign in
            </button>
          </div>
        </div>

        {/* HERO */}
        <section className="row align-items-center mb-5">
          <div className="col-12 col-md-6 mb-4">
            <h1 className="fw-bold" style={{ fontSize: "2.3rem" }}>
              Boxing x Kettlebell.
              <br />
              <span style={{ color: accent }}>A conditioning system</span> — not random workouts.
            </h1>

            <p className="mt-3" style={{ opacity: 0.9 }}>
              BXKR is a repeatable 10-round structure that blends boxing skill,
              kettlebell strength and metabolic conditioning.
            </p>

            <p className="small" style={{ opacity: 0.75 }}>
              Built for busy people who want structure, accountability and real progress —
              without thinking.
            </p>

            <div className="d-flex gap-2 mt-3">
              <button
                className="btn btn-primary"
                style={{ backgroundColor: accent, borderRadius: 24, border: "none" }}
                onClick={() => signIn("google")}
              >
                Start training
              </button>

              <Link
                href="#how"
                className="btn btn-outline-light"
                style={{ borderRadius: 24 }}
              >
                How it works
              </Link>
            </div>
          </div>

          {/* HERO VIDEO PLACEHOLDER */}
          <div className="col-12 col-md-6">
            <div
              style={{
                ...glass,
                height: 280,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#bbb",
              }}
            >
              ▶ Promo / Hero Video Placeholder
            </div>
          </div>
        </section>

        {/* WHO THIS IS FOR */}
        <section className="mb-5">
          <div className="text-center mb-3">
            <h2 className="fw-bold">Who BXKR Is For</h2>
            <p style={{ opacity: 0.85 }}>
              This isn’t for everyone — it’s for people who want consistency.
            </p>
          </div>

          <div className="row">
            {[
              "You want structure, not guessing workouts",
              "You like boxing but still want strength",
              "You train 3–5x per week",
              "You want accountability without pressure",
            ].map((t, i) => (
              <div className="col-12 col-md-6 mb-3" key={i}>
                <div style={{ ...glass, padding: 16 }}>
                  ✔ {t}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* IMAGE STRIP PLACEHOLDER */}
        <section className="mb-5">
          <div
            style={{
              ...glass,
              height: 160,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.7,
            }}
          >
            Gym photos / app screenshots / training images
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="mb-5">
          <div className="text-center mb-3">
            <h2 className="fw-bold">The BXKR Format</h2>
            <p style={{ opacity: 0.85 }}>
              Same structure. Different intent. Progress over time.
            </p>
          </div>

          <div className="row">
            <div className="col-12 col-md-6 mb-3">
              <div style={{ ...glass, padding: 16 }}>
                <h5 className="fw-semibold">Rounds 1–5 — Boxing</h5>
                <p className="small">
                  Skill, speed, power, defence and conditioning.
                  Structured combos — no random smashing.
                </p>
              </div>
            </div>

            <div className="col-12 col-md-6 mb-3">
              <div style={{ ...glass, padding: 16 }}>
                <h5 className="fw-semibold">Rounds 6–10 — Kettlebells</h5>
                <p className="small">
                  Strength, engine and load using proven formats
                  (EMOM, AMRAP, ladders).
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* APP VALUE */}
        <section className="mb-5">
          <div className="text-center mb-3">
            <h2 className="fw-bold">More Than Training</h2>
            <p style={{ opacity: 0.85 }}>
              The app keeps you consistent — even when motivation dips.
            </p>
          </div>

          <div className="row">
            {[
              "Book sessions in seconds",
              "Log nutrition & see trends",
              "Daily habits & weekly check-ins",
              "Progress snapshots — no spreadsheets",
            ].map((f, i) => (
              <div className="col-12 col-md-6 mb-3" key={i}>
                <div style={{ ...glass, padding: 16 }}>
                  {f}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="text-center mb-4" style={{ ...glass, padding: 24 }}>
          <h3 className="fw-bold">Train with intent. Track with purpose.</h3>
          <p style={{ opacity: 0.85 }}>
            Sign in and start your first BXKR session.
          </p>

          <div className="d-flex justify-content-center gap-2">
            <button
              className="btn btn-primary"
              style={{ backgroundColor: accent, borderRadius: 24, border: "none" }}
              onClick={() => signIn("google")}
            >
              Start with Google
            </button>

            <button
              className="btn btn-outline-light"
              style={{ borderRadius: 24 }}
              onClick={() => signIn("email")}
            >
              Continue with Email
            </button>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="text-center" style={{ opacity: 0.6 }}>
          <small>
            © {new Date().getFullYear()} BXKR ·{" "}
            <Link href="/privacy">Privacy</Link> ·{" "}
            <Link href="/terms">Terms</Link>
          </small>
        </footer>
      </main>
    </>
  );
}