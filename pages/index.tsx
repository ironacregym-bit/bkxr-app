// File: pages/index.tsx

import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import styles from "../styles/IronAcreLanding.module.css";

export default function IronAcreLandingPage() {
  const [email, setEmail] = useState("");

  return (
    <>
      <Head>
        <title>Iron Acre</title>
      </Head>

      <div className={styles.page}>

        {/* HEADER */}
        <header className={styles.header}>
          <div className={styles.logo}>IRON ACRE</div>

          <nav className={styles.nav}>
            <Link href="/app">APP</Link>
            <Link href="/gym">GYM</Link>
            <Link href="/podcast">PODCAST</Link>
            <Link href="/work-with-us">WORK WITH US</Link>
          </nav>
        </header>

        <main>

          {/* HERO */}
          <section className={styles.hero}>
            <div className={styles.container}>
              <h1 className={styles.heroBrand}>IRON ACRE</h1>

              <h2 className={styles.heroTitle}>
                FIND YOUR <span className={styles.orange}>FIRE</span>
              </h2>

              <p className={styles.heroSubtitle}>
                A modern strength brand combining training, environment,
                community and long-term progression.
              </p>
            </div>
          </section>

          {/* WHAT IS IRON ACRE */}
          <section className={styles.section}>
            <div className={styles.container}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionLine}></div>
                <div className={styles.sectionLabel}>WHAT IS IRON ACRE</div>
              </div>

              <h2 className={styles.bigStatement}>
                BUILT DIFFERENT.
                <br />
                ON PURPOSE.
              </h2>

              <p className={styles.sectionText}>
                Iron Acre is a brand built around a simple idea: training should
                mean something. It should challenge you, shape you, and become
                part of your life — not something you dip in and out of.
              </p>

              <p className={styles.sectionText}>
                Everything we build sits under make you                Everything we build sits under that idea. The gym. The app.
                better over time.
              </p>
            </div>
          </section>

          {/* PEOPLE */}
          <section className={styles.section}>
            <div className={styles.container}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionLine}></div>
                <div className={styles.sectionLabel}>BEHIND IRON ACRE</div>
              </div>

              <div className={styles.people}>
                <div className={styles.person}>
                  <div className={styles.avatar}></div>
                  <div className={styles.personName}>ROB</div>
                  <p className={styles.personText}>
                    Focused on building the system. Programming, product and the
                    long-term direction behind Iron Acre.
                  </p>
                </div>

                <div className={styles.person}>
                  <div className={styles.avatar}></div>
                  <div className={styles.personName}>NICK</div>
                  <p className={styles.personText}>
                    Focused on the experience. Coaching, training and building
                    the environment people want to be part of.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* PATHS */}
          <section className={styles.section}>
            <div className={styles.container}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionLine}></div>
                <div className={styles.sectionLabel}>CHOOSE YOUR PATH</div>
              </div>

              <h2 className={styles.sectionTitle}>
                WHERE DO YOU START?
              </h2>

              <div className={styles.pathGrid}>

                <div className={styles.card}>
                  <div className={styles.image}></div>
                  <i className="fa-solid fa-mobile-screen-button"></i>
                  <h4 className={styles.green}>TRAINING APP</h4>
                  <p>Structured programming and progression tracking.</p>
                  <Link href="/app" className={styles.btnGreen}>ENTER</Link>
                </div>

                <div className={styles.card}>
                  <div className={styles.image}></div>
                  <i className="fa-solid fa-dumbbell"></i>
                  <h4 className={styles.green}>IRON ACRE GYM</h4>
                  <p>Outdoor strength training built around progression.</p>
                  <Link href="/gym" className={styles.btnGreen}>ENTER</Link>
                </div>

                <div className={styles.card}>
                  <div className={styles.image}></div>
                  <i className="fa-solid fa-fire"></i>
                  <h4 className={styles.orange}>ROUND THE FIRE</h4>
                  <p>Ideas, conversations and the mindset behind the brand.</p>
                  <Link href="/podcast" className={styles.btnOrange}>LISTEN</Link>
                </div>

                <div className={styles.card}>
                  <div className={styles.image}></div>
                  <i className="fa-solid fa-handshake"></i>
                  <h4 className={styles.orange}>WORK WITH US</h4>
                  <p>Collaborate, coach or build with Iron Acre.</p>
                  <Link href="/work-with-us" className={styles.btnOrange}>EXPLORE</Link>
                </div>

              </div>
            </div>
          </section>

        </main>
      </div>
    </>
  );
}
