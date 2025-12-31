
import Head from "next/head";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect, useMemo } from "react";

export default function Landing() {
  const { status } = useSession();
  const router = useRouter();
  const accent = "#FF8A2A";

  /**
   * TODO: Replace this with your real WhatsApp number (E.164 without '+')
   * e.g. UK mobile: '447912345678'
   */
  const whatsappNumber = "447860861120";

  // Pre-filled WhatsApp message for In-Person interest
  const waHref = useMemo(() => {
    const msg = encodeURIComponent(
      "Hi – I'm interested in trying a BXKR class at Iron Acre Gym in Westerfield. Could you share the next available sessions and how to book?"
    );
    // wa.me requires the number without '+' or spaces
    return `https://wa.me/${whatsappNumber}?text=${msg}`;
  }, [whatsappNumber]);

  // Keep authenticated users on "/" (main app home)
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

  return (
    <>
      <Head>
        <title>BXKR — Boxing x Kettlebell Hybrid Transformation</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="container py-4" style={{ paddingBottom: 80 }}>
        {/* TOP BAR */}
        <div className="d-flex justify-content-between align-items-center mb-4 futuristic-card">
          <div className="d-flex align-items-center gap-2">
            <img
              src="/BXKRLogoNoBG.jpg"
              alt="BXKR"
              style={{ height: 36, width: "auto", display: "block" }}
            />
          </div>

          {/* Route to the register page instead of direct NextAuth */}
          <Link href="/register" className="bxkr-btn" aria-label="Sign in">
            Sign in
          </Link>
        </div>

        {/* HERO */}
        <section className="row align-items-center mb-5">
          <div className="col-12 col-md-6 mb-4">
            <h1 className="fw-bold" style={{ fontSize: "2.6rem", lineHeight: 1.2 }}>
              A Hybrid <span style={{ color: accent }}>Boxing &amp; Kettlebell</span>
              <br />
              Transformation Programme
            </h1>

            <p className="mt-3 text-dim">
              BXKR blends boxing (fitness &amp; technique) with kettlebell functional strength
              to build real conditioning, skill and athleticism — not random workouts.
            </p>

            <p className="small text-dim">
              Train in person at Iron Acre Gym — an open barn on a working farm in Westerfield —
              or go fully online inside the BXKR app.
            </p>

            <div className="d-flex gap-2 mt-3 flex-wrap">
              {/* Route to register page */}
              <Link href="/register" className="bxkr-btn">
                Start Your Transformation
              </Link>
              <Link href="#compare" className="btn-bxkr-outline">
                Compare Options
              </Link>
            </div>
          </div>

          <div className="col-12 col-md-6">
            <div
              className="futuristic-card d-flex align-items-center justify-content-center"
              style={{ height: 300, textAlign: "center", fontWeight: 600 }}
            >
              Skill • Strength • Conditioning • Accountability
            </div>
          </div>
        </section>

        {/* IN-PERSON TRAINING */}
        <section className="mb-5" id="inperson">
          <div className="text-center mb-4">
            <h2 className="fw-bold">In‑Person BXKR at Iron Acre Gym (Westerfield)</h2>
            <p className="text-dim">
              Train in an open barn on a working farm. Raw atmosphere. Serious training. Coach‑led
              sessions. A proper environment for people who want to get better.
            </p>
          </div>

          <div className="row g-3 align-items-stretch">
            <div className="col-12 col-md-6">
              <div className="futuristic-card p-0" style={{ overflow: "hidden" }}>
                <img
                  src="/barn-gym.jpg"
                  alt="Iron Acre Gym — open barn on a working farm"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div className="futuristic-card p-4 h-100">
                <h4 className="fw-bold">A Training Environment Like No Other</h4>
                <p className="text-dim small mt-2">
                  Fresh air through the barn. Bags and pads. Chalk and bells. No mirrors. No fluff.
                  Just quality work and progression with coaching.
                </p>

                <ul className="small text-dim mt-3">
                  <li>Unlimited BXKR sessions each week</li>
                  <li>Coach‑led boxing conditioning &amp; kettlebell strength</li>
                  <li>Real technique, real progression — not boxercise</li>
                  <li>Community, energy &amp; accountability</li>
                  <li>Includes full BXKR app access</li>
                </ul>

                <div className="fw-bold mt-3" style={{ fontSize: "1.2rem" }}>
                  £60 / month
                </div>
                <div className="small text-dim">Or pay‑as‑you‑go: £8 per class</div>

                <div className="d-flex gap-2 mt-3 flex-wrap">
                  <a href={waHref} target="_blank" rel="noopener noreferrer" className="bxkr-btn">
                    Join In‑Person via WhatsApp
                  </a>
                  <Link href="#online" className="btn-bxkr-outline">
                    See Online Programme
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ONLINE PROGRAMME */}
        <section className="mb-5" id="online">
          <div className="text-center mb-4">
            <h2 className="fw-bold">BXKR Online Programme</h2>
            <p className="text-dim">
              The full BXKR system delivered through the app — train anywhere, track everything,
              and progress every week.
            </p>
          </div>

          <div className="row g-3 align-items-stretch">
            <div className="col-12 col-md-6 order-md-2">
              <div className="futuristic-card p-0" style={{ overflow: "hidden" }}>
                <img
                  src="/bxkr-app.jpg"
                  alt="BXKR app — workouts, habits, nutrition tracking"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
            </div>

            <div className="col-12 col-md-6 order-md-1">
              <div className="futuristic-card p-4 h-100">
                <h4 className="fw-bold">Train Anywhere. Stay Accountable.</h4>
                <p className="text-dim small mt-2">
                  Structure beats motivation. BXKR Online gives you hybrid boxing &amp; kettlebell
                  training, habit tracking, nutrition logging, and smart progress — all inside a
                  clean, fast app.
                </p>

                <ul className="small text-dim mt-3">
                  <li>10‑round structured sessions (Boxing 1–5, Kettlebells 6–10)</li>
                  <li>Habit tracking with daily check‑off</li>
                  <li>Nutrition logging with barcode scanner</li>
                  <li>Weekly overview, streaks &amp; micro‑stats</li>
                  <li>Workout scheduling &amp; class booking</li>
                  <li>Push notification accountability</li>
                </ul>

                <div className="fw-bold mt-3" style={{ fontSize: "1.2rem" }}>
                  £20 / month
                </div>
                <div className="small text-dim">Start anywhere. Train consistently.</div>

                <div className="d-flex gap-2 mt-3 flex-wrap">
                  {/* Route to register page */}
                  <Link href="/register" className="bxkr-btn">
                    Join BXKR Online
                  </Link>
                  <Link href="#inperson" className="btn-bxkr-outline">
                    See In‑Person Option
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COMPARISON */}
        <section className="mb-5" id="compare">
          <div className="text-center mb-4">
            <h2 className="fw-bold">Which BXKR Is Right for You?</h2>
          </div>

          <div className="row">
            <div className="col-12 col-md-6 mb-3">
              <div className="futuristic-card p-4 h-100">
                <h4 className="fw-semibold" style={{ color: accent }}>
                  In‑Person at Iron Acre
                </h4>
                <ul className="small text-dim mt-2">
                  <li>Open‑barn training environment (Westerfield)</li>
                  <li>Coach‑led sessions with technique cues</li>
                  <li>Unlimited BXKR group workouts</li>
                  <li>Community, energy &amp; accountability</li>
                  <li>Includes full BXKR app access</li>
                </ul>
                <div className="fw-bold mt-3">£60 / month</div>
                <div className="small text-dim">Or £8 per class (PAYG)</div>

                <div className="d-flex gap-2 mt-3">
                  <a href={waHref} target="_blank" rel="noopener noreferrer" className="bxkr-btn">
                    Join In‑Person via WhatsApp
                  </a>
                  <Link href="#online" className="btn-bxkr-outline">
                    Learn More
                  </Link>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6 mb-3">
              <div className="futuristic-card p-4 h-100">
                <h4 className="fw-semibold" style={{ color: accent }}>
                  BXKR Online
                </h4>
                <ul className="small text-dim mt-2">
                  <li>Train anywhere — home, gym, outdoors</li>
                  <li>Track habits, nutrition &amp; progression</li>
                  <li>Hybrid boxing + kettlebell structure</li>
                  <li>Daily accountability via push notifications</li>
                  <li>Lower cost than in‑person coaching</li>
                </ul>
                <div className="fw-bold mt-3">£20 / month</div>

                <div className="d-flex gap-2 mt-3">
                  {/* Route to register page */}
                  <Link href="/register" className="bxkr-btn">
                    Join Online
                  </Link>
                  <Link href="#inperson" className="btn-bxkr-outline">
                    Learn More
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="text-center text-dim small">
          © {new Date().getFullYear()} BXKR · <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/terms">Terms</Link>
        </footer>
      </main>
       </>
  );
}
