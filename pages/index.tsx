// File: pages/index.tsx

import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import styles from "../styles/IronAcreLanding.module.css";

type ApiResp =
  | { ok: true; existed: boolean }
  | { ok: false; error: string; detail?: string };

function getStr(q: unknown): string {
  if (typeof q === "string") return q;
  if (Array.isArray(q) && q.length) return String(q[0] || "");
  return "";
}

function normEmail(v: string) {
  return v.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function IronAcreLandingPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const utm = useMemo(() => {
    const q = router.query || {};

    return {
      utm_source: getStr((q as Record<string, unknown>).utm_source),
      utm_medium: getStr((q as Record<string, unknown>).utm_medium),
      utm_campaign: getStr((q as Record<string, unknown>).utm_campaign),
      utm_content: getStr((q as Record<string, unknown>).utm_content),
      utm_term: getStr((q as Record<string, unknown>).utm_term),
    };
  }, [router.query]);

  async function submit() {
    setError(null);

    const e = normEmail(email);

    if (!e || !isValidEmail(e)) {
      setError("Enter a valid email.");
      return;
    }

    setLoading(true);

    try {
      const resp = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          email: e,
          founders_interest: false,
          consent: true,
          source: "iron-acre-brand-home",
          utm,
          referrer: typeof document !== "undefined" ? document.referrer : "",
        }),
      });

      const data = (await resp.json().catch(() => null)) as ApiResp | null;

      if (!resp.ok || !data || data.ok !== true) {
        let err = "";

        if (data && data.ok === false) {
          err = data.error;
        }

        setError(
          err === "RATE_LIMITED"
            ? "Too many attempts. Try again in a few minutes."
            : "Could not join. Try again."
        );

        setLoading(false);
        return;
      }

      router.push(`/waitlist/thanks?email=${encodeURIComponent(e)}&founders=0`);
    } catch {
      setError("Could not join. Try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Iron Acre</title>
        <meta
          name="description"
          content="Iron Acre is a modern strength brand combining outdoor training, digital coaching, community, content and performance-focused systems."
        />
        <meta property="og:title" content="Iron Acre" />
        <meta
          property="og:description"
          content="Find Your Fire. A modern strength brand built around training, environment, community and progress."
        />
        <meta property="og:type" content="website" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={styles.page}>
        <header className={styles.header}>
          <Link href="/" className={styles.brand}>
            <span className={styles.logoMark} aria-hidden="true">
              IA
            </span>
            <span className={styles.brandText}>Iron Acre</span>
          </Link>

          <nav className={styles.nav} aria-label="Main navigation">
            <Link href="/app" className={styles.navLink}>
              App
            </Link>
            <Link href="/gym" className={styles.navLink}>
              Gym
            </Link>
            <Link href="/podcast" className={styles.navLink}>
              Podcast
            </Link>
            <Link href="/work-with-us" className={styles.navLink}>
              Work With Us
            </Link>
          </nav>
        </header>

        <main>
          <section className={styles.hero} aria-label="Iron Acre">
            <div className={styles.heroInner}>
              <div className={styles.heroEyebrow}>IRON ACRE</div>

              <h1 className={styles.heroTitle}>
                Find
                <br />
                Your Fire
              </h1>

              <p className={styles.heroSubtitle}>
                A modern strength brand built around training, environment,
                community and progress. Iron Acre brings together outdoor
                training, digital coaching, content and connection under one
                clear system.
              </p>

              <div className={styles.heroCtas}>
                <Link href="/app" className="ia-btn ia-btn-primary">
                  Start Training
                </Link>

                <Link href="/podcast" className={styles.heroSecondary}>
                  Round The Fire Podcast
                </Link>
              </div>

              <div className={styles.heroMeta} aria-label="Iron Acre pillars">
                <span className={styles.metaPillGreen}>Training</span>
                <span className={styles.metaPillGreen}>Progression</span>
                <span className={styles.metaPillOrange}>Community</span>
                <span className={styles.metaPillOrange}>Content</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionInner}>
              <div className={styles.sectionEyebrow}>WHAT IRON ACRE IS</div>

              <h2 className={styles.sectionTitle}>
                One brand built to help people train harder, live stronger and
                stay connected to something real.
              </h2>

              <p className={styles.sectionText}>
                Iron Acre is the overarching brand behind the training app, the
                outdoor gym, the podcast and future community-led projects. It
                is built around the idea that training should be structured,
                meaningful and part of a bigger lifestyle — not just another
                fitness product.
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionInner}>
              <div className={styles.sectionEyebrow}>BEHIND IRON ACRE</div>

              <h2 className={styles.sectionTitle}>
                Built by people who train, coach, build and care about the
                experience.
              </h2>

              <p className={styles.sectionText}>
                Iron Acre is being built from the ground up with a simple aim:
                create a better way for people to train, progress and belong.
                Every part of the brand is designed to feel practical, grounded
                and useful — from the gym floor to the app, the content and the
                community around it.
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionInner}>
              <div className={styles.sectionEyebrow}>CHOOSE YOUR PATH</div>

              <h2 className={styles.sectionTitle}>
                Four ways into the Iron Acre ecosystem.
              </h2>

              <div className={styles.pathList}>
                <Link href="/app" className={styles.pathRow}>
                  <div className={styles.pathMeta}>
                    <span className={styles.pathNumberGreen}>01</span>
                    <span>Training</span>
                  </div>

                  <div className={styles.pathContent}>
                    <h3 className={styles.greenTitle}>Iron Acre Training App</h3>
                    <p>
                      Structured programming, workout logging, check-ins,
                      strength tracking and digital coaching.
                    </p>
                  </div>

                  <span className={styles.pathActionGreen}>Enter App</span>
                </Link>

                <Link href="/gym" className={styles.pathRow}>
                  <div className={styles.pathMeta}>
                    <span className={styles.pathNumberGreen}>02</span>
                    <span>Training</span>
                  </div>

                  <div className={styles.pathContent}>
                    <h3 className={styles.greenTitle}>Iron Acre Gym</h3>
                    <p>
                      Outdoor strength and conditioning in a rural setting, built
                      around coaching, progression and experience.
                    </p>
                  </div>

                  <span className={styles.pathActionGreen}>View Gym</span>
                </Link>

                <Link href="/podcast" className={styles.pathRow}>
                  <div className={styles.pathMeta}>
                    <span className={styles.pathNumberOrange}>03</span>
                    <span>Community</span>
                  </div>

                  <div className={styles.pathContent}>
                    <h3 className={styles.orangeTitle}>
                      Round The Fire Podcast
                    </h3>
                    <p>
                      Conversations around training, life, mindset, community and
                      the ideas that sit behind Iron Acre.
                    </p>
                  </div>

                  <span className={styles.pathActionOrange}>Listen</span>
                </Link>

                <Link href="/work-with-us" className={styles.pathRow}>
                  <div className={styles.pathMeta}>
                    <span className={styles.pathNumberOrange}>04</span>
                    <span>Community</span>
                  </div>

                  <div className={styles.pathContent}>
                    <h3 className={styles.orangeTitle}>Work With Us</h3>
                    <p>
                      Coaching, partnerships, collaborations and future ways to
                      build with the Iron Acre brand.
                    </p>
                  </div>

                  <span className={styles.pathActionOrange}>Explore</span>
                </Link>
              </div>
            </div>
          </section>

          <section className={styles.splitSection}>
            <div className={styles.splitInner}>
              <div>
                <div className={styles.sectionEyebrow}>TRAINING SYSTEM</div>

                <h2 className={styles.splitTitle}>
                  Green is for training, performance and progression.
                </h2>

                <p className={styles.splitText}>
                  The app and gym sit on the performance side of Iron Acre. This
                  is where programming, coaching, tracking, sessions and member
                  progress live.
                </p>
              </div>

              <div>
                <div className={styles.orangeEyebrow}>COMMUNITY LAYER</div>

                <h2 className={styles.splitTitle}>
                  Orange is for community, story and connection.
                </h2>

                <p className={styles.splitText}>
                  The podcast, collaborations and wider brand content carry the
                  human side of Iron Acre — the conversations, ideas and culture
                  around the training.
                </p>
              </div>
            </div>
          </section>

          <section className={styles.captureSection}>
            <div className={styles.captureInner}>
              <div className={styles.captureCopy}>
                <div className={styles.sectionEyebrow}>STAY CLOSE</div>

                <h2 className={styles.captureTitle}>
                  Get updates across the full Iron Acre brand.
                </h2>

                <p className={styles.captureText}>
                  Join the list for updates on the app, gym, podcast, community
                  projects and future ways to get involved.
                </p>
              </div>

              <div className={styles.captureForm}>
                <input
                  className={`form-control ${styles.emailInput}`}
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                />

                {error ? <div className={styles.formError}>{error}</div> : null}

                <button
                  type="button"
                  className={`ia-btn ia-btn-primary ${styles.submitButton}`}
                  disabled={loading}
                  onClick={submit}
                >
                  {loading ? "Joining…" : "Join the List"}
                </button>

                <p className={styles.finePrint}>
                  No payment is taken here. This is only for Iron Acre launch
                  and brand updates.
                </p>
              </div>
            </div>
          </section>

          <footer className={styles.footer}>
            <div className={styles.footerInner}>
              <div>
                <div className={styles.footerTitle}>Iron Acre</div>
                <div className={styles.footerSub}>
                  Training. Community. Progress.
                </div>
              </div>

              <div className={styles.footerLinks}>
                <a href="#" aria-label="Iron Acre Instagram">
                  Instagram
                </a>
                <a href="#" aria-label="Iron Acre YouTube">
                  YouTube
                </a>
                <a href="#" aria-label="Iron Acre TikTok">
                  TikTok
                </a>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </>
  );
}
