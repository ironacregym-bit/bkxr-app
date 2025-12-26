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
        <title>BXKR — Boxing x Kettlebell Transformation System</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container py-4" style={{ paddingBottom: 80 }}>
        {/* TOP BAR */}
        <div className="d-flex justify-content-between align-items-center mb-4 bxkr-card p-3">
          <div className="fw-bold">BXKR</div>
          <button
            className="btn-bxkr"
            onClick={() => signIn("google")}
            disabled={status === "loading"}
          >
            Sign in
          </button>
        </div>

        {/* HERO */}
        <section className="row align-items-center mb-5">
          <div className="col-12 col-md-6 mb-4">
            <h1 className="fw-bold" style={{ fontSize: "2.4rem" }}>
              10 Rounds.
              <br />
              <span style={{ color: accent }}>One system.</span>
            </h1>

            <p className="mt-3 text-dim">
              BXKR is a structured boxing & kettlebell transformation system.
              Same format. Every session. Progress over time.
            </p>

            <p className="small text-dim">
              Built for people who want structure, accountability and real
              conditioning — not random workouts.
            </p>

            <div className="d-flex gap-2 mt-3 flex-wrap">
              <button className="btn-bxkr" onClick={() => signIn("google")}>
                Start Training
              </button>
              <Link href="#how" className="btn-bxkr-outline">
                How It Works
              </Link>
            </div>
          </div>

          <div className="col-12 col-md-6">
            <div
              className="bxkr-card d-flex align-items-center justify-content-center"
              style={{ height: 280, opacity: 0.7 }}
            >
              ▶ BXKR Training Video
            </div>
          </div>
        </section>

        {/* WHO IT'S FOR */}
        <section className="mb-5">
          <div className="text-center mb-3">
            <h2 className="fw-bold">Who BXKR Is For</h2>
            <p className="text-dim">
              This isn’t casual fitness. It’s coached, repeatable training.
            </p>
          </div>

          <div className="row">
            {[
              "You want structure, not guessing workouts",
              "You like boxing but want strength too",
              "You train 3–5x per week",
              "You want accountability without babysitting",
            ].map((t, i) => (
              <div className="col-12 col-md-6 mb-3" key={i}>
                <div className="bxkr-card p-3">✔ {t}</div>
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="mb-5">
          <div className="text-center mb-3">
            <h2 className="fw-bold">The BXKR Format</h2>
            <p className="text-dim">
              Same structure. Different intent. Measurable progress.
            </p>
          </div>

          <div className="row">
            <div className="col-12 col-md-6 mb-3">
              <div className="bxkr-card p-4">
                <h5 className="fw-semibold">Rounds 1–5 · Boxing</h5>
                <p className="small text-dim">
                  Pad & bag combinations focused on conditioning, coordination,
                  speed and power. No random smashing.
                </p>
              </div>
            </div>

            <div className="col-12 col-md-6 mb-3">
              <div className="bxkr-card p-4">
                <h5 className="fw-semibold">Rounds 6–10 · Kettlebells</h5>
                <p className="small text-dim">
                  Strength & conditioning using simple, proven formats:
                  EMOMs, ladders, circuits.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* TRAINING OPTIONS */}
        <section className="mb-5">
          <div className="text-center mb-3">
            <h2 className="fw-bold">Choose How You Train</h2>
            <p className="text-dim">Same BXKR system. Different delivery.</p>
          </div>

          <div className="row">
            <div className="col-12 col-md-6 mb-3">
              <div className="bxkr-card p-4 h-100">
                <h5 className="fw-semibold">In-Person BXKR</h5>
                <ul className="small text-dim mt-2">
                  <li>Unlimited BXKR sessions</li>
                  <li>Open gym access</li>
                  <li>Coach-led training</li>
                  <li>Full BXKR app access</li>
                </ul>
                <div className="fw-bold mt-3">£60 / month</div>
                <div className="small text-dim">
                  Founders · £80 later in 2025
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6 mb-3">
              <div className="bxkr-card p-4 h-100">
                <h5 className="fw-semibold">Online BXKR</h5>
                <ul className="small text-dim mt-2">
                  <li>BXKR boxing & kettlebell programming</li>
                  <li>Weekly structure & progression</li>
                  <li>Habits & nutrition tracking</li>
                  <li>Train anywhere</li>
                </ul>
                <div className="fw-bold mt-3">£30 / month</div>
                <div className="small text-dim">Online only</div>
              </div>
            </div>
          </div>
        </section>

        {/* FOUNDERS STRIP */}
        <section className="mb-5">
          <div className="bxkr-card p-4 text-center">
            <h4 className="fw-bold">Founders Pricing — Limited</h4>
            <p className="small text-dim">
              Early members lock in lower pricing before BXKR fully opens.
            </p>
            <div className="d-flex justify-content-center gap-2 flex-wrap mt-2">
              <span className="bxkr-chip">£8 per session</span>
              <span className="bxkr-chip">£60 unlimited</span>
              <span className="bxkr-chip">£80 later</span>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="bxkr-card p-4 text-center mb-4">
          <h3 className="fw-bold">Start BXKR the Right Way</h3>
          <p className="text-dim">
            Create an account, choose your training option,
            and lock in founders pricing.
          </p>

          <div className="d-flex justify-content-center gap-2 flex-wrap">
            <button className="btn-bxkr" onClick={() => signIn("google")}>
              Get Started
            </button>
            <button
              className="btn-bxkr-outline"
              onClick={() => signIn("email")}
            >
              Use Email
            </button>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="text-center text-dim small">
          © {new Date().getFullYear()} BXKR ·{" "}
          <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/terms">Terms</Link>
        </footer>
      </main>
    </>
  );
}