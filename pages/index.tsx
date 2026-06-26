import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import styles from "../styles/IronAcreLanding.module.css";
import { useEffect, useState } from "react";

export default function IronAcreLandingPage() { 
useEffect(() => {
  const sections = document.querySelectorAll(`.${styles.pillar}`);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add(styles.active);
        }
      });
    },
    { threshold: 0.6 }
  );

  sections.forEach((section) => observer.observe(section));

  return () => observer.disconnect();
}, []);
  return (
    <>
      <Head>
        <title>Iron Acre</title>
      </Head>

      <div className={styles.page}>

        {/* HEADER */}
        <header className={styles.header}>
          <Link href="/" className={styles.logoWrap}>
            <Image
              src="/IronAcreNoBG.png"
              alt="Iron Acre"
              width={50}
              height={50}
            />
          </Link>

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
              alt="Firepit"
              fill
              priority
              className={styles.heroImg}
            />
          
            <div className={styles.heroOverlay} />
          
            <div className={styles.heroContent}>
              <div className={styles.heroLogoWrap}>
                <Image
                  src="/IronAcreNoBG.png"
                  alt="Iron Acre logo"
                  width={220}
                  height={220}
                />
              </div>
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
              FIND YOUR <span className={styles.orange}>FIRE</span>
              </h2>

              <p className={styles.text}>
                Iron Acre is a system designed for real progression.
                Not short bursts. Not noise. Something that compounds over time.
              </p>

              <p className={styles.text}>
                The gym, the app, the conversations and the people —
                all built to move you forward.
              </p>
            </div>
          </section>

          {/* PATHS */}
<section className={styles.pillars}>

  <div className={styles.pillar}>
    <div className={styles.pillarContent}>

      <div className={styles.progress}></div>

      <h3>
        <i className="fa-solid fa-mobile-screen-button" />
        THE APP
      </h3>

      <p>
        Structured training, progression tracking and a system that keeps you
        consistent wherever you train.
      </p>

      <Link href="/app" className={styles.btnOutline}>
        ENTER
      </Link>

    </div>
  </div>


  <div className={styles.pillar}>
    <div className={styles.pillarContent}>

      <div className={styles.progress}></div>

      <h3>
        <i className="fa-solid fa-dumbbell" />
        THE GYM
      </h3>

      <p>
        Outdoor strength training built around progression, environment and real
        effort.
      </p>

      <Link href="/gym" className={styles.btnOutline}>
        ENTER
      </Link>

    </div>
  </div>


  <div className={styles.pillar}>
    <div className={styles.pillarContent}>

      <div className={styles.progress}></div>

      <h3>
        <i className="fa-solid fa-fire" />
        THE PODCAST
      </h3>

      <p>
        Conversations, ideas and mindset behind building strength and living
        properly.
      </p>

      <Link href="/podcast" className={styles.btnOutline}>
        LISTEN
      </Link>

    </div>
  </div>


  <div className={styles.pillar}>
    <div className={styles.pillarContent}>

      <div className={styles.progress}></div>

      <h3>
        <i className="fa-solid fa-handshake" />
        WORK WITH US
      </h3>

      <p>
        Coaching, partnerships and opportunities to build something bigger
        with Iron Acre.
      </p>

      <Link href="/work-with-us" className={styles.btnOutline}>
        EXPLORE
      </Link>

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
                <a href="#" target="_blank">INSTAGRAM</a>
                <a href="#" target="_blank">YOUTUBE</a>
                <a href="#" target="_blank">TIKTOK</a>
              </div>
            </div>
          </section>

          {/* FOOTER */}
          <footer className={styles.footer}>
            © Iron Acre
          </footer>

        </main>
      </div>
    </>
  );
}
