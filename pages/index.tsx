import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import styles from "../styles/IronAcreLanding.module.css";
import { useEffect, useState } from "react";

export default function IronAcreLandingPage() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const section = document.getElementById("path-section");
      if (!section) return;
  
      const rect = section.getBoundingClientRect();
      const height = window.innerHeight;
  
      if (rect.top <= 0 && rect.bottom >= height) {
        const progress = Math.abs(rect.top) / height;
        const newStep = Math.min(3, Math.floor(progress));
        setStep(newStep);
      }
    };
  
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
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
          <section id="path-section" className={styles.pathScroll}>
          
            <div className={styles.pathSticky}>
          
              <div className={styles.pathInner}>
          
                {/* LEFT CONTENT */}
                <div className={styles.pathContent}>
          
                  {step === 0 && (
                    <>
                      <h2 className={styles.stepTitle}>
                        <i className="fa-solid fa-mobile-screen-button" />
                        <span className={styles.green}>APP</span>
                      </h2>
                      <p>Structured weeks. Track everything. Train anywhere.</p>
          
                      <Link href="/app" className={styles.btnGreen}>
                        ENTER
                      </Link>
                    </>
                  )}
          
                  {step === 1 && (
                    <>
                      <h2 className={styles.stepTitle}>
                        <i className="fa-solid fa-dumbbell" />
                        <span className={styles.green}>GYM</span>
                      </h2>
                      <p>Outdoor strength training built for progression.</p>
          
                      <Link href="/gym" className={styles.btnGreen}>
                        ENTER
                      </Link>
                    </>
                  )}
          
                  {step === 2 && (
                    <>
                      <h2 className={styles.stepTitle}>
                        <i className="fa-solid fa-fire" />
                        <span className={styles.orange}>PODCAST</span>
                      </h2>
                      <p>Ideas, mindset and conversations.</p>
          
                      <Link href="/podcast" className={styles.btnOrange}>
                        LISTEN
                      </Link>
                    </>
                  )}
          
                  {step === 3 && (
                    <>
                      <h2 className={styles.stepTitle}>
                        <i className="fa-solid fa-handshake" />
                        <span className={styles.orange}>WORK WITH US</span>
                      </h2>
                      <p>Coaching, collaboration and building together.</p>
          
                      <Link href="/work-with-us" className={styles.btnOrange}>
                        EXPLORE
                      </Link>
                    </>
                  )}
          
                </div>
          
                {/* RIGHT VISUAL */}
                <div className={styles.pathVisual}>
                  <div className={styles.mockPhone}></div>
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
