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
   * WhatsApp number (E.164 without '+')
   * UK example: '447912345678'
   */
  const whatsappNumber = "447860861120";

  // Pre-filled WhatsApp message for In-Person interest
  const waHref = useMemo(() => {
    const msg = encodeURIComponent(
      "Hi – I'm interested in booking a trial BXKR class at Iron Acre Gym in Westerfield. Could you share the next available sessions?"
    );
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
        <title>BXKR — Boxing & Kettlebell Training</title>
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

          <Link href="/register" className="bxkr-btn" aria-label="Sign in">
            Sign in
          </Link>
        </div>

        {/* HERO */}
        <section className="row align-items-center mb-5">
          <div className="col-12 col-md-6 mb-4">
            <h1 className="fw-bold" style={{ fontSize: "2.6rem", lineHeight: 1.2 }}>
              Boxing &amp; <span style={{ color: accent }}>Kettlebell</span>
              <br />
              Training Done Properly
            </h1>

            <p className="mt-3 text-dim">
              BXKR combines boxing conditioning and kettlebell strength into structured,
              coach-led sessions designed to build real fitness — not random workouts.
            </p>

            <p className="small text-dim">
              Train in person at Iron Acre Gym — an open barn on a working farm in Westerfield.
              Small groups. Real coaching. Measurable progress.
            </p>

            <div className="d-flex gap-2 mt-3 flex-wrap">
              <Link href="#inperson" className="bxkr-btn">
                Train In-Person
              </Link>
              <Link href="/online" className="btn-bxkr-outline">
                Train Online
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
            <h2 className="fw-bold">In-Person BXKR at Iron Acre Gym (Westerfield)</h2>
            <p className="text-dim">
              Train in an open barn on a working farm. Raw atmosphere. Serious training.
              Coach-led sessions built for progress.
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
                  Fresh air through the barn. Bags and bells. Chalk and sweat.
                  No mirrors. No fluff. Just quality work with coaching.
                </p>

                <ul className="small text-dim mt-3">
                  <li>Unlimited BXKR sessions each week</li>
                  <li>Coach-led boxing &amp; kettlebell training</li>
                  <li>Real technique and progression</li>
                  <li>Small group accountability</li>
                  <li>Includes full BXKR app access</li>
                </ul>

                <div className="fw-bold mt-3" style={{ fontSize: "1.2rem" }}>
                  £60 / month
                </div>
                <div className="small text-dim">Or £8 per class (PAYG)</div>

                <div className="d-flex gap-2 mt-3 flex-wrap">
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bxkr-btn"
                  >
                    Book a Trial Session (WhatsApp)
                  </a>
                  <Link href="/online" className="btn-bxkr-outline">
                    View Online Programme
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
              The full BXKR system delivered through the app — train anywhere,
              stay consistent, and track progress properly.
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
                  Structure beats motivation. BXKR Online gives you the same hybrid
                  boxing &amp; kettlebell logic — without needing to be on-site.
                </p>

                <ul className="small text-dim mt-3">
                  <li>Structured 10-round BXKR sessions</li>
                  <li>Habit &amp; nutrition tracking</li>
                  <li>Weekly progress overview</li>
                  <li>Workout scheduling &amp; reminders</li>
                  <li>Lower cost than in-person coaching</li>
                </ul>

                <div className="fw-bold mt-3" style={{ fontSize: "1.2rem" }}>
                  £20 / month
                </div>

                <div className="d-flex gap-2 mt-3 flex-wrap">
                  <Link href="/online" className="bxkr-btn">
                    View BXKR Online
                  </Link>
                  <Link href="#inperson" className="btn-bxkr-outline">
                    Train In-Person Instead
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COMPARISON */}
        <section className="mb-5" id="compare">
          <div className="text-center mb-4">
            <h2 className="fw-bold">Choose Your BXKR Path</h2>
          </div>

          <div className="row">
            <div className="col-12 col-md-6 mb-3">
              <div className="futuristic-card p-4 h-100">
                <h4 className="fw-semibold" style={{ color: accent }}>
                  In-Person at Iron Acre
                </h4>
                <ul className="small text-dim mt-2">
                  <li>Open-barn training environment</li>
                  <li>Coach-led sessions</li>
                  <li>Unlimited group workouts</li>
                  <li>Community &amp; accountability</li>
                  <li>Includes BXKR app access</li>
                </ul>

                <div className="fw-bold mt-3">£60 / month</div>
                <div className="small text-dim">Or £8 per class</div>

                <div className="d-flex gap-2 mt-3">
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bxkr-btn"
                  >
                    Book Trial (WhatsApp)
                  </a>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6 mb-3">
              <div className="futuristic-card p-4 h-100">
                <h4 className="fw-semibold" style={{ color: accent }}>
                  BXKR Online
                </h4>
                <ul className="small text-dim mt-2">
                  <li>Train anywhere</li>
                  <li>Hybrid boxing + kettlebell system</li>
                  <li>Progress tracking &amp; habits</li>
                  <li>Lower cost, high structure</li>
                </ul>

                <div className="fw-bold mt-3">£20 / month</div>

                <div className="d-flex gap-2 mt-3">
                  <Link href="/online" className="bxkr-btn">
                    View Online Programme
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