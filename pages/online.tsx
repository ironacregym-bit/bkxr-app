import Head from "next/head";
import Link from "next/link";
import { ReactNode } from "react";

const ACCENT = "#FF8A2A";

export default function OnlineLanding(): JSX.Element {
  return (
    <>
      <Head>
        <title>BXKR Online — Boxing & Kettlebell Training App</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container py-4" style={{ paddingBottom: 80 }}>
        {/* NAV */}
        <div className="d-flex justify-content-between align-items-center mb-4 futuristic-card">
          <img
            src="/BXKRLogoNoBG.jpg"
            alt="BXKR"
            style={{ height: 36 }}
          />

          <Link href="/register" className="bxkr-btn">
            Sign in
          </Link>
        </div>

        {/* HERO */}
        <section className="text-center mb-5">
          <h1 className="fw-bold" style={{ fontSize: "2.8rem", lineHeight: 1.15 }}>
            Boxing & Kettlebell Training.
            <br />
            <span style={{ color: ACCENT }}>Built for Consistency.</span>
          </h1>

          <p className="text-dim mt-3" style={{ fontSize: "1.1rem" }}>
            Follow a proven hybrid training system with workouts, mobility,
            nutrition tracking and weekly check-ins — all inside one app.
          </p>

          <div className="d-flex justify-content-center gap-3 mt-4 flex-wrap">
            <Link href="/register" className="bxkr-btn">
              Start Training Today
            </Link>

            <Link href="#features" className="btn-bxkr-outline">
              What’s Included
            </Link>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="mb-5">
          <div className="text-center mb-4">
            <h2 className="fw-bold">Everything You Need. Nothing You Don’t.</h2>
          </div>

          <div className="row g-4">
            <Feature title="3 Structured Workouts / Week">
              Boxing + kettlebell sessions designed to progress strength,
              conditioning and skill — no random circuits.
            </Feature>

            <Feature title="Mobility & Recovery">
              Guided mobility sessions to keep you training consistently,
              not breaking down.
            </Feature>

            <Feature title="Habit Tracking">
              Daily check-ins that turn training into a non-negotiable habit.
            </Feature>

            <Feature title="Nutrition Logging">
              Barcode scanner, meals, recipes and shopping lists included.
            </Feature>

            <Feature title="Weekly Check-Ins">
              Review your week, spot gaps and stay accountable.
            </Feature>

            <Feature title="Train Anywhere">
              Home, gym, outdoors — all sessions are app-guided and flexible.
            </Feature>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="mb-5">
          <div className="text-center mb-4">
            <h2 className="fw-bold">How BXKR Online Works</h2>
          </div>

          <div className="row text-center g-4">
            <Step number={1} title="Follow the Plan">
              3 workouts per week with optional mobility.
            </Step>

            <Step number={2} title="Track Everything">
              Habits, nutrition and sessions logged in one place.
            </Step>

            <Step number={3} title="Review Weekly">
              Stay consistent, adjust and progress.
            </Step>
          </div>
        </section>

        {/* PRICING */}
        <section className="text-center mb-5">
          <h2 className="fw-bold">Simple Pricing</h2>

          <div className="futuristic-card p-4 mt-3 d-inline-block">
            <div className="fw-bold" style={{ fontSize: "1.8rem" }}>
              £20 / month
            </div>

            <p className="text-dim small mb-3">
              Cancel anytime. Train anywhere.
            </p>

            <Link href="/register" className="bxkr-btn">
              Join BXKR Online
            </Link>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="text-center">
          <h3 className="fw-bold">Consistency Beats Motivation.</h3>
          <p className="text-dim">
            BXKR gives you the structure. You do the work.
          </p>

          <Link href="/register" className="bxkr-btn mt-2">
            Start Now
          </Link>
        </section>

        <footer className="text-center text-dim small mt-5">
          © {new Date().getFullYear()} BXKR ·{" "}
          <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/terms">Terms</Link>
        </footer>
      </main>
    </>
  );
}

/* ---------- Components ---------- */

interface FeatureProps {
  title: string;
  children: ReactNode;
}

function Feature({ title, children }: FeatureProps): JSX.Element {
  return (
    <div className="col-12 col-md-6 col-lg-4">
      <div className="futuristic-card p-4 h-100">
        <h5 className="fw-semibold">{title}</h5>
        <p className="text-dim small">{children}</p>
      </div>
    </div>
  );
}

interface StepProps {
  number: number;
  title: string;
  children: ReactNode;
}

function Step({ number, title, children }: StepProps): JSX.Element {
  return (
    <div className="col-12 col-md-4">
      <div className="futuristic-card p-4 h-100">
        <div className="fw-bold mb-2" style={{ fontSize: "1.4rem" }}>
          {number}
        </div>
        <h6 className="fw-semibold">{title}</h6>
        <p className="text-dim small">{children}</p>
      </div>
    </div>
  );
}