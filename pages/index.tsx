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
        <meta
          name="description"
          content="Iron Acre is a modern strength brand combining outdoor training, digital coaching, community and content."
        />
      </Head>

      <div className={styles.page}>
        <main>

          {/* HERO */}
          <section className={styles.hero}>
            <div className={styles.container}>
              <h1 className={styles.heroBrand}>Iron Acre</h1>
              <h2 className={styles.heroTitle}>Find Your Fire</h2>

              <p className={styles.heroSubtitle}>
                A modern strength brand built around training, environment,
                community and progress.
              </p>
            </div>
          </section>


          {/* WHAT */}
          <section className={styles.section}>
            <div className={styles.container}>
              <div className={styles.eyebrow}>IRON ACRE</div>

              <h2 className={styles.sectionTitle}>
                More than a gym. More than an app.
              </h2>

              <p className={styles.sectionText}>
                Iron Acre brings together outdoor training, a digital coaching
                app, a podcast and a wider community into one system designed
                to help people train consistently and get stronger over time.
              </p>
            </div>
          </section>


          {/* BEHIND */}
          <section className={styles.section}>
            <div className={styles.container}>
              <div className={styles.eyebrow}>BEHIND IRON ACRE</div>

              <div className={styles.people}>
                <div className={styles.person}>
                  <div className={styles.avatar}></div>
                  <div className={styles.personName}>Rob</div>
                </div>

                <div className={styles.person}>
                  <div className={styles.avatar}></div>
                  <div className={styles.personName}>Nick</div>
                </div>
              </div>
            </div>
          </section>


          {/* PATHS */}
          <section className={styles.section}>
            <div className={styles.container}>
              <div className={styles.eyebrow}>CHOOSE YOUR PATH</div>

              <h2 className={styles.sectionTitle}>Enter the Tribe</h2>

              <div className={styles.pathGrid}>

                <div className={styles.pathCard}>
                  <div className={styles.image}></div>
                  <i className="fa-solid fa-dumbbell"></i>
                  <h4>Iron Acre App</h4>

                  <Link href="/app" className={styles.button}>
                    Enter
                  </Link>
                </div>

                <div className={styles.pathCard}>
                  <div className={styles.image}></div>
                  <i className="fa-solid fa-tree"></i>
                  <h4>Iron Acre Gym</h4>

                  <Link href="/gym" className={styles.button}>
                    Enter
                  </Link>
                </div>

                <div className={styles.pathCard}>
                  <div className={styles.image}></div>
                  <i className="fa-solid fa-fire"></i>
                  <h4>Round The Fire</h4>

                  <Link href="/podcast" className={styles.button}>
                    Listen
                  </Link>
                </div>

                <div className={styles.pathCard}>
                  <div className={styles.image}></div>
                  <i className="fa-solid fa-handshake"></i>
                  <h4>Work With Us</h4>

                  <Link href="/work-with-us" className={styles.button}>
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

              <div className={styles.form}>
                <input
                  type="email"
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
                <a href="#" className={styles.social}>Instagram</a>
                <a href="#" className={styles.social}>YouTube</a>
                <a href="#" className={styles.social}>TikTok</a>
              </div>
            </div>
          </section>

        </main>
      </div>
    </>
  );
}
