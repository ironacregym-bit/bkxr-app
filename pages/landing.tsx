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
  const glassCard = {
    background: "rgba(255,255,255,0.05)",
    borderRadius: "16px",
    padding: "16px",
    backdropFilter: "blur(10px)",
    boxShadow: "0 4px 20px rgba(0,0,0,0.45)",
  } as const;

  return (
    <>
      <Head>
        <title>BXKR — Boxing x Kettlebell Rounds</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main
        className="container py-4"
        style={{
          minHeight: "100vh",
          paddingBottom: "90px",
          background: "linear-gradient(135deg, #1a1a1a 0%, #2e1a0f 100%)",
          color: "#fff",
          borderRadius: "12px",
        }}
      >
        {/* Top Ribbon */}
        <div
          className="d-flex justify-content-between align-items-center mb-3"
          style={{ ...glassCard, padding: "12px 16px" }}
        >
          <div className="d-flex align-items-center gap-2">
            <i className="fas fa-bolt" style={{ color: accent }} />
            <span className="fw-semibold">BXKR</span>
          </div>

          <div className="d-flex gap-2">
            <button
              className="btn btn-primary btn-sm"
              style={{
                backgroundColor: accent,
                borderRadius: "24px",
                fontWeight: 600,
                border: "none",
              }}
              onClick={() => signIn("google")}
              disabled={status === "loading"}
            >
              Sign in with Google
            </button>
            <button
              className="btn btn-outline-light btn-sm"
              style={{ borderRadius: "24px" }}
              onClick={() => signIn("email")}
              disabled={status === "loading"}
            >
              Continue with Email
            </button>
          </div>
        </div>

        {/* Hero */}
        <section className="text-center mb-4" style={{ ...glassCard, padding: "24px" }}>
          <h1 className="fw-bold" style={{ fontSize: "2rem" }}>
            Boxing x Kettlebell — 10 Rounds. One System.
          </h1>
          <p className="mt-2" style={{ opacity: 0.9 }}>
            BXKR blends the skill of <span className="fw-semibold">boxing</span> with the
            conditioning of <span className="fw-semibold">kettlebells</span> in a simple,
            repeatable format.
          </p>

          <div className="d-flex justify-content-center gap-2 mt-3">
            <button
              className="btn btn-primary"
              style={{
                backgroundColor: accent,
                borderRadius: "24px",
                fontWeight: 600,
                border: "none",
                padding: "8px 18px",
              }}
              onClick={() => signIn("google")}
              disabled={status === "loading"}
            >
              Start with Google
            </button>

            <button
              className="btn btn-outline-light"
              style={{ borderRadius: "24px", padding: "8px 18px" }}
              onClick={() => signIn("email")}
              disabled={status === "loading"}
            >
              Continue with Email
            </button>

            <Link
              href="#why"
              className="btn btn-outline-light"
              style={{ borderRadius: "24px", padding: "8px 18px" }}
            >
              Why
            </Link>
          </div>

          {/* Challenge Card */}
          <div
            className="d-flex align-items-center justify-content-between mt-4"
            style={{
              borderRadius: "50px",
              padding: "12px 16px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              color: "#fff",
              background: "linear-gradient(90deg, rgba(58,47,47,0.9), rgba(46,26,15,0.9))",
            }}
          >
            <div
              className="d-flex align-items-center justify-content-center me-3"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.1)",
              }}
            >
              <i className="fas fa-crown" style={{ color: "#ffcc00" }} />
            </div>
            <div className="flex-grow-1">
              <div className="fw-semibold">New challenge</div>
              <div className="small" style={{ opacity: 0.85 }}>
                2 weeks of engine—book, train, log nutrition, repeat.
              </div>
            </div>
            <button
              className="btn btn-light"
              style={{ borderRadius: "24px", fontWeight: 600 }}
              onClick={() =>
                window.location.assign("/nutrition?date=" + new Date().toISOString().slice(0, 10))
              }
            >
              Start
            </button>
          </div>
        </section>

        {/* Why BXKR */}
        <section id="why" className="mb-4">
          <div className="text-center mb-3">
            <h2 className="fw-bold">Why BXKR?</h2>
            <p style={{ opacity: 0.85 }}>Practical programming. Real progression. No fluff.</p>
          </div>

          <div className="row gx-3">
            {[
              {
                icon: "fa-gloves",
                title: "Skill + Strength",
                text: "5 boxing rounds for skill, 5 kettlebell rounds for strength & conditioning.",
              },
              {
                icon: "fa-stopwatch",
                title: "Always 10 Rounds",
                text: "3 minutes each—simple to schedule, easy to track, brutal when done right.",
              },
              {
                icon: "fa-utensils",
                title: "Nutrition Logging",
                text: "Log meals from open food database. See macros trend.",
              },
              {
                icon: "fa-calendar-check",
                title: "1-Click Booking",
                text: "Share WhatsApp booking links—no app needed.",
              },
              {
                icon: "fa-chart-line",
                title: "Progress & Benchmarks",
                text: "Benchmarks baked in—see sets, cals, and sessions trend.",
              },
              {
                icon: "fa-shield-heart",
                title: "Coach Guidance",
                text: "Reminders and lightweight admin to keep you accountable.",
              },
            ].map((f, idx) => (
              <div className="col-12 col-md-6 mb-3" key={idx}>
                <div style={{ ...glassCard }}>
                  <div className="d-flex align-items-start gap-3">
                    <div
                      className="d-flex align-items-center justify-content-center"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.1)",
                      }}
                    >
                      <i className={`fas ${f.icon}`} style={{ color: accent, fontSize: "18px" }} />
                    </div>
                    <div>
                      <div className="fw-semibold">{f.title}</div>
                      <div className="small" style={{ opacity: 0.85 }}>
                        {f.text}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Format */}
        <section className="mb-4">
          <div className="text-center mb-3">
            <h2 className="fw-bold">The BXKR Format</h2>
            <p style={{ opacity: 0.85 }}>A repeatable structure balancing skill & capacity.</p>
          </div>
          <div className="row gx-3">
            <div className="col-12 col-md-6 mb-3">
              <div style={{ ...glassCard }}>
                <h5 className="fw-semibold mb-2">Rounds 1–5: Boxing</h5>
                <ul style={{ opacity: 0.9 }}>
                  <li>Basics</li>
                  <li>Speed</li>
                  <li>Power</li>
                  <li>Defensive</li>
                  <li>Engine</li>
                </ul>
                <small className="text-muted">Each: 3 × 1-minute combos.</small>
              </div>
            </div>

            <div className="col-12 col-md-6 mb-3">
              <div style={{ ...glassCard }}>
                <h5 className="fw-semibold mb-2">Rounds 6–10: Kettlebell</h5>
                <ul style={{ opacity: 0.9 }}>
                  <li>Engine</li>
                  <li>Power</li>
                  <li>Ladder</li>
                  <li>Core</li>
                  <li>Load</li>
                </ul>
                <small className="text-muted">Formats: AMRAP / EMOM / Ladder.</small>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-4">
          <div className="text-center mb-3">
            <h2 className="fw-bold">How It Works</h2>
          </div>

          <div className="row gx-3">
            {[
              { step: "1", title: "Sign in", text: "Set location + macros." },
              { step: "2", title: "Book & Train", text: "Tap a session and smash your rounds." },
              { step: "3", title: "Log & Progress", text: "Log meals and watch rings close." },
            ].map((s, idx) => (
              <div className="col-12 col-md-4 mb-3" key={idx}>
                <div style={{ ...glassCard, textAlign: "center" }}>
                  <div
                    className="d-inline-flex align-items-center justify-content-center mb-2"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <span className="fw-bold" style={{ color: accent }}>
                      {s.step}
                    </span>
                  </div>
                  <div className="fw-semibold">{s.title}</div>
                  <div className="small" style={{ opacity: 0.85 }}>
                    {s.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="mb-4">
          <div className="text-center mb-3">
            <h2 className="fw-bold">What Athletes Say</h2>
          </div>
          <div className="row gx-3">
            {[
              {
                name: "Sam P.",
                text: "BXKR makes training simple—boxing focus without losing strength.",
              },
              {
                name: "Rach H.",
                text: "The macro rings are addictive. Nutrition finally clicked.",
              },
              {
                name: "Mike K.",
                text: "WhatsApp booking is genius—mates join instantly.",
              },
            ].map((t, idx) => (
              <div className="col-12 col-md-4 mb-3" key={idx}>
                <div style={{ ...glassCard }}>
                  <div className="small" style={{ opacity: 0.9 }}>
                    “{t.text}”
                  </div>
                  <div className="mt-2 small text-muted">— {t.name}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="mb-4">
          <div className="text-center mb-3">
            <h2 className="fw-bold">Pricing</h2>
            <p style={{ opacity: 0.85 }}>Start free. Upgrade as you grow.</p>
          </div>

          <div className="row gx-3">
            <div className="col-12 col-md-6 mb-3">
              <div style={{ ...glassCard, textAlign: "center" }}>
                <h5 className="fw-semibold">Free Taster</h5>
                <p className="small" style={{ opacity: 0.85 }}>
                  Try any class + 12 weeks of online training.
                </p>

                <button
                  className="btn btn-primary"
                  style={{
                    backgroundColor: accent,
                    borderRadius: "24px",
                    fontWeight: 600,
                    border: "none",
                  }}
                  onClick={() => signIn("google")}
                >
                  Get Started
                </button>
              </div>
            </div>

            <div className="col-12 col-md-6 mb-3">
              <div style={{ ...glassCard, textAlign: "center" }}>
                <h5 className="fw-semibold">Member</h5>
                <p className="small" style={{ opacity: 0.85 }}>
                  £60/month — access sessions and full BXKR engine.
                </p>

                <Link href="#why" className="btn btn-outline-light">
                  Learn More
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="text-center mb-2" style={{ ...glassCard, padding: "24px" }}>
          <h3 className="fw-bold">Ready to build your engine?</h3>
          <p style={{ opacity: 0.9 }}>Tap below to sign in and begin.</p>
          <div className="d-flex justify-content-center gap-2">
            <button
              className="btn btn-primary"
              style={{
                backgroundColor: accent,
                borderRadius: "24px",
                fontWeight: 600,
                border: "none",
                padding: "8px 18px",
              }}
              onClick={() => signIn("google")}
            >
              Sign in with Google
            </button>

            <button
              className="btn btn-outline-light"
              style={{ borderRadius: "24px", padding: "8px 18px" }}
              onClick={() => signIn("email")}
            >
              Continue with Email
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center mt-3" style={{ opacity: 0.7 }}>
          <small>
            © {new Date().getFullYear()} BXKR. All rights reserved.{" "}
            <Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms</Link>
          </small>
        </footer>
      </main>
    </>
  );
}
