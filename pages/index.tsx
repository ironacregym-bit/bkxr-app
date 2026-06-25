// pages/index.tsx

import Head from "next/head";
import Link from "next/link";
import styles from "../styles/IronAcreLanding.module.css";

export default function IronAcreLandingPage() {
  return (
    <>
      <Head>
        <title>Iron Acre</title>
        <meta
          name="description"
          content="Iron Acre is a modern strength brand combining outdoor training, digital coaching, and performance-focused systems."
        />
      </Head>

      <main className={styles.page}>
        {/* Header / Logo */}
        <header className={styles.header}>
          <div className={styles.logo}>IRON ACRE</div>
        </header>

        {/* Hero */}
        <section className={styles.hero}>
          <h1 className={styles.title}>Find Your Fire</h1>
          <p className={styles.subtitle}>
            Strength. Structure. Environment. Built for real progress.
          </p>
        </section>

        {/* What is Iron Acre */}
        <section className={styles.section}>
          <p className={styles.lead}>
            Iron Acre is a modern strength system combining outdoor training,
            structured programming, and a digital coaching layer — designed to
            help you train consistently and get stronger over time.
          </p>
        </section>

        {/* Paths */}
        <section className={styles.section}>
          <div className={styles.pathRow}>
            <div className={styles.pathText}>
              <h2>Train at the Gym</h2>
              <p>
                Outdoor strength training in a focused, small-group environment.
                Built around progression, not randomness.
              </p>
            </div>
            <Link href="/gym" className={styles.pathLink}>
              View Gym
            </Link>
          </div>

          <div className={styles.pathRow}>
            <div className={styles.pathText}>
              <h2>Use the App</h2>
              <p>
                Log workouts, track strength, and follow structured training
                wherever you are.
              </p>
            </div>
            <Link href="/app" className={styles.pathLink}>
              View App
            </Link>
          </div>
        </section>

        {/* Founders */}
        <section className={styles.founders}>
          <h2>Founding Members</h2>
          <p>
            Be part of the first group building Iron Acre. Limited spaces, fixed
            rate, long-term progression.
          </p>
          <Link href="/founders" className={styles.foundersLink}>
            See Founders Offer
          </Link>
        </section>

        {/* Email Capture */}
        <section className={styles.section}>
          <h2>Stay Updated</h2>
          <form className={styles.form}>
            <input
              type="email"
              placeholder="Enter your email"
              className={styles.input}
            />
            <button type="submit" className={styles.button}>
              Join
            </button>
          </form>
        </section>

        {/* Social */}
        <footer className={styles.footer}>
          <div className={styles.socials}>
            <a href="#" target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
            <a href="#" target="_blank" rel="noopener noreferrer">
              YouTube
            </a>
          </div>
        </footer>
      </main>
    </>
  );
}
