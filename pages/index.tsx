// File: pages/index.tsx

import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
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
          <div className={styles.logoWrap}>
            <Image
              src="/IronAcreNoBG.png"
              alt="Iron Acre"
              width={140}
              height={40}
            />
          </div>

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
            <Image
              src="/IronAcreFirePit.png"
              alt=""
              fill
              priority
              className={styles.heroImage}
            />

            <div className={styles.heroOverlay} />

            <div className={styles.heroContent}>
              <h1 className={styles.heroBrand}>IRON ACRE</h1>

              <h2 className={styles.heroTitle}>
                FIND YOUR <span>FIRE</span>
              </h2>
            </div>
          </section>


          {/* WHAT */}
          <section className={styles.section}>
            <div className={styles.container}>
              <div className={styles.sectionHeader}>
                <span className={styles.line} />
                <span className={styles.label}>WHAT IS IRON ACRE</span>
              </div>

              <h2 className={styles.statement}>
                BUILT DIFFERENT.
                <br />
                ON PURPOSE.
              </h2>

              <p className={styles.text}>
                Iron Acre is built around progress that actually lasts.
                Training that means something. Systems that connect.
              </p>

              <p className={styles.text}>
                The gym, the app, the conversations and the people — all
                designed to move you forward over time.
              </p>
            </div>
          </section>


          {/* PEOPLE */}
          <section className={styles.section}>
            <div className={styles.container}>
              <div className={styles.sectionHeader}>
                <span className={styles.line} />
                <span className={styles.label}>BEHIND IRON ACRE</span>
              </div>

              <div className={styles.people}>
                <div>
                  <div className={styles.avatar} />
                  <h4>ROB</h4>
                  <p>Product, systems and long-term direction.</p>
                </div>

                <div>
                  <div className={styles.avatar} />
                  <h4>NICK</h4>
                  <p>Training, experience and community.</p>
                </div>
              </div>
            </div>
          </section>


          {/* PATHS */}
          <section className={styles.section}>
            <div className={styles.container}>
              <div className={styles.sectionHeader}>
                <span className={styles.line} />
                <span className={styles.label}>WHERE DO YOU START</span>
              </div>

              <div className={styles.paths}>

                <div>
                  <div className={styles.pathTitle}>
                    <i className="fa-solid fa-mobile-screen-button" />
                    <span className={styles.green}>APP</span>
                  </div>
                  <p>Train anywhere. Track everything.</p>
                  <Link href="/app" className={styles.btnGreen}>ENTER</Link>
                </div>

                <div>
                  <div className={styles.pathTitle}>
                    <i className="fa-solid fa-dumbbell" />
                    <span className={styles.green}>GYM</span>
                  </div>
                  <p>Outdoor strength training.</p>
                  <Link href="/gym" className={styles.btnGreen}>ENTER</Link>
                </div>

                <div>
                  <div className={styles.pathTitle}>
                    <i className="fa-solid fa-fire" />
                    <span className={styles.orange}>PODCAST</span>
                  </div>
                  <p>Ideas and conversations.</p>
                  <Link href="/podcast" className={styles.btnOrange}>LISTEN</Link>
                </div>

                <div>
                  <div className={styles.pathTitle}>
                    <i className="fa-solid fa-handshake" />
                    <span className={styles.orange}>WORK WITH US</span>
                  </div>
                  <p>Build with Iron Acre.</p>
                  <Link href="/work-with-us" className={styles.btnOrange}>EXPLORE</Link>
                </div>

              </div>
            </div>
          </section>


          {/* FOLLOW */}
          <section className={styles.section}>
            <div className={styles.container}>
              <div className={styles.sectionHeader}>
                <span className={styles.line} />
                <span className={styles.label}>FOLLOW THE ACRE</span>
              </div>

              <div className={styles.socials}>
                <a href="#"><i className="fa-brands fa-instagram" /> INSTAGRAM</a>
                <a href="#"><i className="fa-brands fa-youtube" /> YOUTUBE</a>
                <a href="#"><i className="fa-brands fa-tiktok" /> TIKTOK</a>
              </div>
            </div>
          </section>


          {/* FOOTER */}
          <footer className={styles.footer}>
            <p>© Iron Acre</p>
          </footer>

        </main>
      </div>
    </>
  );
}
