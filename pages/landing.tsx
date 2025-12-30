
import Head from "next/head";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";

export default function Landing() {
  const { status } = useSession();
  const accent = "#FF8A2A";

  return (
    <>
      <Head>
        <title>BXKR — Boxing x Kettlebell Hybrid Transformation</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container py-4" style={{ paddingBottom: 80 }}>
        {/* TOP NAV / LOGO */}
        <div className="d-flex justify-content-between align-items-center mb-4 bxkr-card p-3">
          <div className="fw-bold" style={{ fontSize: "1.4rem" }}>
            BXKR
          </div>
          <button
            className="bxkr-btn"
            onClick={() => signIn("google")}
            disabled={status === "loading"}
          >
            Sign in
          </button>
        </div>

        {/* HERO SECTION */}
        <section className="row align-items-center mb-5">
          <div className="col-12 col-md-6 mb-4">
            <h1 className="fw-bold" style={{ fontSize: "2.6rem", lineHeight: 1.2 }}>
              A Hybrid
              <br />
              <span style={{ color: accent }}>Boxing & Kettlebell</span>
              <br />
              Transformation System
            </h1>

            <p className="mt-3 text-dim">
              Built for everyday people who want structure, skill and conditioning —
              without the chaos of random workouts.
            </p>

            <p className="small text-dim">
              The BXKR method blends boxing (fitness & technique) with kettlebell
              functional strength to create a programme that builds real athleticism.
            </p>

            <div className="d-flex gap-2 mt-3 flex-wrap">
              <button className="bxkr-btn" onClick={() => signIn("google")}>
                Start Your Transformation
              </button>
              <Link href="#compare" className="btn-bxkr-outline">
                Compare Training Options
              </Link>
            </div>
          </div>

          <div className="col-12 col-md-6">
            <div
              className="bxkr-card d-flex align-items-center justify-content-center"
              style={{
                height: 300,
                background: "rgba(255,255,255,0.05)",
                backdropFilter: "blur(12px)",
                borderRadius: 20,
                textAlign: "center",
                fontWeight: 600,
                opacity: 0.9,
              }}
            >
              Hybrid Training • Skill • Strength • Conditioning
            </div>
          </div>
        </section>

        {/* IN-PERSON TRAINING SECTION */}
        <section className="mb-5" id="inperson">
          <div className="text-center mb-4">
            <h2 className="fw-bold">In‑Person BXKR at Iron Acre Gym</h2>
            <p className="text-dim">
              Train in an open‑air barn on a working farm in Westerfield.
              Raw atmosphere. Serious training.
            </p>
          </div>

          <div className="bxkr-card p-4 mb-4">
            <img
              src="/barn-gym.jpg"
              alt="Iron Acre Gym"
              style={{ width: "100%", borderRadius: 16, marginBottom: 20 }}
            />

            <h4 className="fw-bold">A Training Environment Like No Other</h4>
            <p className="text-dim small mt-2">
              Iron Acre Gym is a functional training space inside an open barn.
              Fresh air rolling through. The sound of gloves hitting bags.
              Chalk on hands. Bells swinging. No mirrors — just work.
            </p>

            <ul className="small text-dim mt-3">
              <li>Unlimited BXKR group sessions every week</li>
              <li>Coach‑led boxing conditioning & kettlebell strength</li>
              <li>Real technique, real progression — not boxercise</li>
              <li>Founders pricing for early members</li>
              <li>Full access to the BXKR app</li>
            </ul>

            <div className="fw-bold mt-3" style={{ fontSize: "1.2rem" }}>
              £60 / month
            </div>
            <div className="small text-dim">Open‑barn training in Westerfield</div>

            <div className="d-flex gap-2 mt-3 flex-wrap">
              <button className="bxkr-btn" onClick={() => signIn("google")}>
                Join In‑Person BXKR
              </button>
            </div>
          </div>
        </section>

        {/* ONLINE TRAINING SECTION */}
        <section className="mb-5" id="online">
          <div className="text-center mb-4">
            <h2 className="fw-bold">BXKR Online Programme</h2>
            <p className="text-dim">
              The full BXKR transformation system — anywhere, anytime.
            </p>
          </div>

          <div className="bxkr-card p-4 mb-4">
            <img
              src="/bxkr-app.jpg"
              alt="BXKR App"
              style={{ width: "100%", borderRadius: 16, marginBottom: 20 }}
            />

            <h4 className="fw-bold">Train Anywhere. Stay Accountable Everywhere.</h4>

            <p className="text-dim small mt-2">
              BXKR Online gives you the full structure of the in‑person programme:
              boxing conditioning, kettlebell strength, habits, nutrition, progress,
              and smart workout tracking — all inside a sleek, fast app.
            </p>

            <ul className="small text-dim mt-3">
              <li>10‑round structured training sessions</li>
              <li>Habit tracking with daily check‑off</li>
              <li>Nutrition logging with barcode scanner</li>
              <li>Progress stats, streaks & weekly overview</li>
              <li>Workout scheduling & class booking</li>
              <li>Push‑notification accountability</li>
            </ul>

            <div className="fw-bold mt-3" style={{ fontSize: "1.2rem" }}>
              £30 / month
            </div>
            <div className="small text-dim">Train anywhere with the BXKR app</div>

            <div className="d-flex gap-2 mt-3 flex-wrap">
              <button className="bxkr-btn" onClick={() => signIn("google")}>
                Join BXKR Online
              </button>
            </div>
          </div>
        </section>

        {/* COMPARISON SECTION */}
        <section className="mb-5" id="compare">
          <div className="text-center mb-4">
            <h2 className="fw-bold">Which BXKR Is Right for You?</h2>
            <p className="text-dim">Choose the training style that fits your life.</p>
          </div>

          <div className="row">
            <div className="col-12 col-md-6 mb-3">
              <div className="bxkr-card p-4 h-100">
                <h4 className="fw-semibold" style={{ color: accent }}>
                  In‑Person at Iron Acre
                </h4>
                <ul className="small text-dim mt-2">
                  <li>Open‑barn training environment</li>
                  <li>Coach‑led sessions with technique cues</li>
                  <li>Unlimited BXKR group workouts</li>
                  <li>Community, energy and accountability</li>
                  <li>Includes full BXKR app access</li>
                </ul>
                <div className="fw-bold mt-3">£60 / month</div>
              </div>
            </div>

            <div className="col-12 col-md-6 mb-3">
              <div className="bxkr-card p-4 h-100">
                <h4 className="fw-semibold" style={{ color: accent }}>
                  BXKR Online
                </h4>
                <ul className="small text-dim mt-2">
                  <li>Train anywhere, no gym required</li>
                  <li>Track habits, nutrition & progression</li>
                  <li>Structured hybrid training sessions</li>
                  <li>Daily accountability & notifications</li>
                  <li>Cheaper than in‑person coaching</li>
                </ul>
                <div className="fw-bold mt-3">£30 / month</div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="bxkr-card p-4 text-center mb-4">
          <h3 className="fw-bold">Start Your BXKR Journey</h3>
          <p className="text-dim">
            Choose the version that fits your life — in person, or online from anywhere.
          </p>

          <div className="d-flex justify-content-center gap-2 flex-wrap mt-3">
            <button className="bxkr-btn" onClick={() => signIn("google")}>
              Get Started
            </button>
            <button className="btn-bxkr-outline" onClick={() => signIn("email")}>
              Use Email
            </button>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="text-center text-dim small">
          © {new Date().getFullYear()} BXKR ·{" "}
          <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link>
        </footer>
      </main>
    </>
  );
}
