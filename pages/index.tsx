// File: pages/index.tsx//

import Image from "next/image";
import Head frmo "next/head";
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

  const logoSrc = "/iron_acre_logo_transparent.png";
  const heroImageSrc = "/concept-3.jpg";
  const conceptImageSrc = "/concept-2.jpg";

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
        const err = (data as ApiResp | null)?.ok === false ? data.error : "";

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
          content="Iron Acre is a modern strength brand combining outdoor training, digital coaching, content and community."
        />
        <meta property="og:title" content="Iron Acre" />
        <meta
          property="og:description"
          content="Find Your Fire. Outdoor training, digital coaching, community and performance-driven systems."
        />
        <meta property="og:type" content="website" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className={styles.page}>
        <section className={styles.hero} aria-label="Iron Acre">
          <div className={styles.heroMedia} aria-hidden="true">
            <Image
              src={heroImageSrc}
              alt=""
              fill
              priority
              sizes="100vw"
              className={styles.heroImage}
            />
          </div>

          <div className={styles.heroOverlay} aria-hidden="true" />

          <header className={styles.header}>
            <Link href="/" className={styles.brand} aria-label="Iron Acre home">
              <span className={styles.brandLogo} aria-hidden="true">
                <Image
                  src={logoSrc}
                  alt=""
                  width={42}
                  height={42}
                  priority
                  className={styles.logoImage}
                />
              </span>
              <span className={styles.brandText}>Iron Acre</span>
            </Link>

            <nav className={styles.nav} aria-label="Main navigation">
              <Link href="/waitlist" className={styles.navLink}>
                Waitlist
              </Link>
              <Link href="/founders" className={styles.navLink}>
                Founders
              </Link>
              <Link href="/gym" className={styles.navLink}>
                Gym
              </Link>
              <Link href="/app" className={styles.navLink}>
                App
              </Link>
            </nav>
          </header>

          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <div className={styles.eyebrow}>IRON ACRE</div>

              <h1 className={styles.headline}>
                Find
                <br />
                Your Fire
              </h1>

              <p className={styles.heroText}>
                A modern strength brand built around outdoor training, digital
                coaching, community and progression that actually lasts.
              </p>

              <div className={styles.heroActions}>
                <Link href="/waitlist" className="ia-btn ia-btn-primary">
                  Join the Waitlist
                </Link>

                <Link href="/founders" className={styles.secondaryAction}>
                  View Founders
                </Link>
              </div>
            </div>

            <div className={styles.heroPanel}>
              <div className={styles.panelLabel}>Built around</div>

              <div className={styles.pillRow} aria-label="Iron Acre pillars">
                <span className={styles.greenPill}>Training</span>
                <span className={styles.greenPill}>Progress</span>
                <span className={styles.orangePill}>Community</span>
              </div>

              <p className={styles.panelText}>
                One brand. Two routes. Train outside at Iron Acre Gym or follow
                structured coaching through the digital app.
              </p>
            </div>
          </div>
        </section>

        <main className={styles.main}>
          <section className={styles.statementSection}>
            <div className={styles.sectionEyebrow}>WHAT IS IRON ACRE?</div>

            <h2 className={styles.statementTitle}>
              Strength training with a clearer system, a better environment and
              a stronger reason to keep showing up.
            </h2>

            <p className={styles.statementText}>
              Iron Acre brings together the physical and digital sides of
              training: an outdoor gym built around committed members, an app
              for structured progress, and a content layer that gives the brand
              a voice beyond the sessions.
            </p>
          </section>

          <section className={styles.pathsSection} aria-labelledby="paths-title">
            <div className={styles.sectionHead}>
              <div className={styles.sectionEyebrow}>CHOOSE YOUR PATH</div>
              <h2 id="paths-title" className={styles.sectionTitle}>
                Start where you are.
              </h2>
            </div>

            <div className={styles.pathList}>
              <Link href="/app" className={styles.pathRow}>
                <div className={styles.pathMeta}>
                  <span className={styles.pathNumber}>01</span>
                  <span className={styles.pathType}>Digital Training</span>
                </div>

                <div className={styles.pathContent}>
                  <h3>Iron Acre App</h3>
                  <p>
                    Follow structured programming, log workouts, track strength,
                    complete check-ins and keep your training moving wherever
                    you are.
                  </p>
                </div>

                <span className={styles.pathArrow}>View App</span>
              </Link>

              <Link href="/gym" className={styles.pathRow}>
                <div className={styles.pathMeta}>
                  <span className={styles.pathNumber}>02</span>
                  <span className={styles.pathType}>Outdoor Training</span>
                </div>

                <div className={styles.pathContent}>
                  <h3>Iron Acre Gym</h3>
                  <p>
                    Coach-led outdoor strength and conditioning sessions in a
                    rural setting built for real progression and a proper member
                    experience.
                  </p>
                </div>

                <span className={styles.pathArrow}>View Gym</span>
              </Link>
            </div>
          </section>

          <section className={styles.imageBreak} aria-label="Iron Acre setting">
            <div className={styles.imageBreakMedia} aria-hidden="true">
              <Image
                src={conceptImageSrc}
                alt=""
                fill
                sizes="100vw"
                className={styles.conceptImage}
              />
            </div>

            <div className={styles.imageBreakOverlay} aria-hidden="true" />

            <div className={styles.imageBreakContent}>
              <div className={styles.sectionEyebrow}>THE ENVIRONMENT</div>
              <h2>Outside changes the session.</h2>
              <p>
                Meadow, woodland, fresh air, early mornings and earned evenings.
                Iron Acre is designed to feel different before the first rep
                even starts.
              </p>
            </div>
          </section>

          <section className={styles.foundersSection}>
            <div className={styles.foundersContent}>
              <div className={styles.orangeEyebrow}>FOUNDERS</div>

              <h2>Build it from the beginning.</h2>

              <p>
                Founders is the early access layer for people who want to be
                part of Iron Acre before it becomes fully public — the first to
                train, test, shape and support what comes next.
              </p>
            </div>

            <Link href="/founders" className={styles.foundersLink}>
              View Founders
            </Link>
          </section>

          <section className={styles.captureSection}>
            <div className={styles.captureCopy}>
              <div className={styles.sectionEyebrow}>STAY CLOSE</div>

              <h2>Get updates on the gym, app and brand launch.</h2>

              <p>
                One email. No noise. We’ll send launch updates, early access
                details and key Iron Acre announcements.
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
                By joining, you agree to receive Iron Acre launch updates. No
                payment is taken here.
              </p>
            </div>
          </section>

          <footer className={styles.footer}>
            <div className={styles.footerBrand}>Iron Acre</div>

            <div className={styles.socialLinks}>
              <a
                href="https://www.instagram.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Instagram
              </a>

              <a
                href="https://www.youtube.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                YouTube
              </a>

              <a
                href="https://www.tiktok.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                TikTok
              </a>
            </div>
          </footer>
        </main>
      </div>
    </>
  );
}
