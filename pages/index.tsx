import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import styles from "../styles/IronAcreLanding.module.css";

export default function IronAcreLandingPage() {
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
              width={60}
              height={60}
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
          <section className={styles.section}>
            <div className={styles.container}>
              <div className={styles.sectionHeader}>
                <span className={styles.line} />
                <span className={styles.label}>WHERE DO YOU START</span>
              </div>

              <div className={styles.paths}>

                <div className={styles.pathItem}>
                  <div className={styles.pathTitle}>
                    <i className="fa-solid fa-mobile-screen-button"></i>
                    <span className={styles.green}>APP</span>
                  </div>
                  <p>Train anywhere. Track everything.</p>
                  <Link href="/app" className={styles.btnGreen}>
                    ENTER
                  </Link>
                </div>

                <div className={styles.pathItem}>
                  <div className={styles.pathTitle}>
                    <i className="fa-solid fa-dumbbell"></i>
                    <span className={styles.green}>GYM</span>
                  </div>
                  <p>Outdoor strength training.</p>
                  <Link href="/gym" className={styles.btnGreen}>
                    ENTER
                  </Link>
                </div>

                <div className={styles.pathItem}>
                  <div className={styles.pathTitle}>
                    <i className="fa-solid fa-fire" {styles.orange}></i>
                    <span className={styles.orange}>PODCAST</span>
                  </div>
                  <p>Ideas and conversations.</p>
                  <Link href="/podcast" className={styles.btnOrange}>
                    LISTEN
                  </Link>
                </div>

                <div className={styles.pathItem}>
                  <div className={styles.pathTitle}>
                    <i className="fa-solid fa-handshake" {styles.orange}></i>
                    <span className={styles.orange}>WORK WITH US</span>
                  </div>
                  <p>Build with Iron Acre.</p>
                  <Link href="/work-with-us" className={styles.btnOrange}>
                    EXPLORE
                  </Link>
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
