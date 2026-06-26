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
            <Link href="/app">App</Link>
            <Link href="/gym">Gym</Link>
            <Link href="/podcast">Podcast</Link>
            <Link href="/work-with-us">Work With Us</Link>
          </nav>
        </header>

        <main>

          {/* HERO */}
          <section className={styles.hero}>
            <div className={styles.container}>
              <h1 className={styles.heroBrand}>Iron Acre</h1>

              <h2 className={styles.heroTitle}>
                Find Your <span className={styles.orange}>Fire</span>
              </h2>

              <p className={styles.heroSubtitle}>
                A modern strength brand combining training, environment,
                community and long-term progression.
              </p>
            </div>
          </section>


          {/* WHAT */}
          <section className={styles.section}>
            <div className={styles.container}>
              <div className={styles.eyebrow}>THE BRAND</div>

              <h2 className={styles.sectionTitle}>
                More than a gym. More than an app.
              </h2>

              <p className={styles.sectionText}>
                Iron Acre brings together outdoor training, a digital platform,
                a podcast and a growing community into one system designed
                for consistent progress over time.
              </p>
            </div>
          </section>


          {/* PEOPLE */}
          <section className={styles.section}>
            <div className={styles.container}>
              <div className={styles.eyebrow}>BUILT BY</div>

              <div className={styles.people}>
                <div className={styles.person}>
                  <div className={styles.avatar}></div>
                  <div className={styles.personName}>Rob</div>
                  <p className={styles.personText}>
                    Builds the systems, the product and the structure behind Iron Acre.
                  </p>
                </div>

                <div className={styles.person}>
                  <div className={styles.avatar}></div>
                  <div className={styles.personName}>Nick</div>
                  <p className={styles.personText}>
                    Focused on training, experience and building the community.
                  </p>
                </div>
              </div>
            </div>
          </section>


          {/* PATHS */}
          <section className={styles.section}>
            <div className={styles.container}>
              <div className={styles.eyebrow}>CHOOSE YOUR PATH</div>

              <h2 className={styles.sectionTitle}>
                Where do you start?
              </h2>

              <div className={styles.pathGrid}>

                {/* APP */}
                <div className={styles.card}>
                  <div className={styles.image}></div>
                  <i className="fa-solid fa-mobile-screen-button"></i>
                  <h4 className={styles.green}>Training App</h4>
                  <p>Structured programming, tracking and digital coaching.</p>

                  <Link href="/app">
                    Enter
                  </Link>
                </div>

                {/* GYM */}
                <div className={styles.card}>
                  <div className={styles.image}></div>
                  <i className="fa-solid fa-dumbbell"></i>
                  <h4 className={styles.green}>Iron Acre Gym</h4>
                  <p>Outdoor strength training built around progression.</p>

                  <Link href="/gym">
                    Enter
                  </Link>
                </div>

                {/* PODCAST */}
                <div className={styles.card}>
                  <div className={styles.image}></div>
                  <i className="fa-solid fa-fire"></i>
                  <h4 className={styles.orange}>Round The Fire</h4>
                  <p>Conversations, ideas and the story behind the brand.</p>

                  <Link href="/podcast">
                    Listen
                  </Link>
                </div>

                {/* WORK */}
                <div className={styles.card}>
                  <div className={styles.image}></div>
                  <i className="fa-solid fa-handshake"></i>
                  <h4 className={styles.orange}>Work With Us</h4>
                  <p>Coaching, collaboration and building with Iron Acre.</p>

                  <Link href="/work-with-us">
                    Explore
                  </Link>
                </div>

              </div>
            </div>
          </section>


          {/* EMAIL */}
          <section className={styles.section}>
            <div className={styles.container}>
              <h2 className={styles.sectionTitle}>Stay Updated</h2>

              <p className={styles.sectionText}>
                Get updates on the gym, the app, the podcast and everything
                happening inside Iron Acre.
              </p>

              <div className={styles.form}>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="form-control"
                />

                <button className="ia-btn ia-btn-primary">
                  Join
                </button>
              </div>
            </div>
          </section>


          {/* SOCIAL */}
          <section className={styles.section}>
            <div className={styles.container}>
              <div className={styles.eyebrow}>FOLLOW</div>

              <div className={styles.socials}>
                <a href="#Instagram"></a>
                <a href="#YouTube"></a>
                <a href="#TikTok"></a>
              </div>
            </div>
          </section>

        </main>
      </div>
    </>
  );
}
