
import Head from "next/head";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import type { GetServerSideProps, GetServerSidePropsContext } from "next";
import { getSession } from "next-auth/react";

export const getServerSideProps: GetServerSideProps = async (
  context: GetServerSidePropsContext
) => {
  const session = await getSession(context);
  // If logged in, go to the app home
  if (session) {
    return {
      redirect: { destination: "/", permanent: false },
    };
  }
  return { props: {} };
};

export default function Landing() {
  const { status } = useSession();

  const accent = "#ff7f32"; // BXKR neon orange
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
        {/* Font Awesome (icons) */}
        https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css
      </Head>

      {/* Page wrapper with futuristic background */}
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
        {/* Top CTA / Login ribbon */}
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
            BXKR blends the skill of <span className="fw-semibold">boxing</span> with the strength
            and conditioning of <span className="fw-semibold">kettlebells</span> in a simple,
            repeatable format. Track nutrition, book sessions, and build engine—fast.
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
           div
            className="d-flex align-items-center justify-content-between"
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
              <i className="fas fa-crown" style={{ color: "#ffcc00" }}></i>
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
                text: "Log meals from open food database. See macros against goals and close the rings.",
              },
              {
                icon: "fa-calendar-check",
                title: "1‑Click Booking",
                text: "Share WhatsApp booking links. Guests can book without installing anything.",
              },
              {
                icon: "fa-chart-line",
                title: "Progress & Benchmarks",
                text: "History and benchmarks baked in—see sets, cals, and sessions trend.",
              },
              {
                icon: "fa-shield-heart",
                title: "Coach Guidance",
                text: "Smart reminders and simple admin so you stay accountable.",
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
                      <i className={`fas ${f.icon}`} style={{ color: accent, fontSize: "18px" }}></i>
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

        {/* BXKR Format (Rounds) */}
        <section className="mb-4">
          <div className="text-center mb-3">
            <h2 className="fw-bold">The BXKR Format</h2>
            <p style={{ opacity: 0.85 }}>A repeatable structure that balances skill and capacity.</p>
          </div>
          <div className="row gx-3">
            <div className="col-12 col-md-6 mb-3">
              <div style={{ ...glassCard }}>
                <h5 className="fw-semibold mb-2">Rounds 1–5: Boxing</h5>
                <ul className="mb-0" style={{ opacity: 0.9 }}>
                  <li>Basics</li>
                  <li>Speed</li>
                  <li>Power</li>
                  <li>Defensive</li>
                  <li>Engine</li>
                </ul>
                <small className="text-muted">Each round: 3 x 1‑minute combos.</small>
              </div>
            </div>
            <div className="col-12 col-md-6 mb-3">
              <div style={{ ...glassCard }}>
                <h5 className="fw-semibold mb-2">Rounds 6–10: Kettlebell</h5>
                <ul className="mb-0" style={{ opacity: 0.9 }}>
                  <li>Engine</li>
                  <li>Power</li>
                  <li>Ladder</li>
                  <li>Core</li>
                  <li>Load</li>
                </ul>
                <small className="text-muted">Work formats: AMRAP / EMOM / Ladder.</small>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mb-4">
          <div className="text-center mb-3">
            <h2 className="fw-bold">How It Works</h2>
          </div>
          <div className="row gx-3">
            {[
              {
                step: "1",
                title: "Sign in",
                text: "Use Google or Email. Set your location and macro targets.",
              },
              {
                step: "2",
                title: "Book & Train",
                text: "Tap a session or use WhatsApp links—then smash your 10 rounds.",
              },
              {
                step: "3",
                title: "Log & Progress",
                text: "Log your meals and see rings close against your macro goals.",
              },
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
                text: "BXKR makes training simple—boxing focus without losing strength work.",
              },
              {
                name: "Rach H.",
                text: "The rings for macros are addictive. Nutrition finally clicked.",
              },
              {
                name: "Mike K.",
                text: "WhatsApp booking is genius—my mates jump in without installing apps.",
              },
            ].map((t, i) => (
              <div className="col-12 col-md-4 mb-3" key={i}>
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
            <p style={{ opacity: 0.85 }}>
              Start free. Upgrade as you grow. (Your gym may run specific promos.)
            </p>
          </div>
          <div className="row gx-3">
            <div className="col-12 col-md-6 mb-3">
              <div style={{ ...glassCard, textAlign: "center" }}>
                <h5 className="fw-semibold">Free Taster</h5>
                <p className="small" style={{ opacity: 0.85 }}>
                  Try any class + 12 weeks of online training when you join.
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
                  £60/month — access sessions, workouts, and the full BXKR engine.
                </p>
                <Link
                  href="#why"
                 ink>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-4">
          <div className="text-center mb-3">
            <h2 className="fw-bold">FAQs</h2>
          </div>
          <div className="row gx-3">
            {[
              {
                q: "Do I need to install an app?",
                a: "No. You can book via WhatsApp links as a guest, and the web app works great on mobile.",
              },
              {
                q: "Is nutrition complicated?",
                a: "No. Search foods from an open database, pick amounts, and watch your rings fill.",
              },
              {
                q: "What equipment do I need?",
                a: "Gloves for boxing and a kettlebell at your level. Your coach or gym will guide selections.",
              },
            ].map((faq, idx) => (
              <div className="col-12 col-md-4 mb-3" key={idx}>
                <div style={{ ...glassCard }}>
                  <div className="fw-semibold">{faq.q}</div>
                  <div className="small" style={{ opacity: 0.85 }}>{faq.a}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="text-center mb-2" style={{ ...glassCard, padding: "24px" }}>
          <h3 className="fw-bold">Ready to build your engine?</h3>
          <p style={{ opacity: 0.9 }}>Tap below to sign in and start your first BXKR session.</p>
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
            <privacyPrivacy</Link> · /termsTerms</Link>
          </small>
        </footer>
      </main>
    </>
  );
}
