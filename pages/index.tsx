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
          <section className={styles.pathScroll}>
          
            <div className={styles.pathStep}>
              <h3><i className="fa-solid fa-mobile-screen-button" /> APP</h3>
              <p>Train anywhere. Track everything. Follow structured programming.</p>
              <Link href="/app" className={styles.btnGreen}>ENTER</Link>
            </div>
          
            <div className={styles.pathStep}>
              <h3><i className="fa-solid fa-dumbbell" /> GYM</h3>
              <p>Outdoor strength training built around real progression.</p>
              <Link href="/gym" className={styles.btnGreen}>ENTER</Link>
            </div>
          
            <div className={styles.pathStep}>
              <h3><i className="fa-solid fa-fire" /> PODCAST</h3>
              <p>Ideas, conversations and mindset behind Iron Acre.</p>
              <Link href="/podcast" className={styles.btnOrange}>LISTEN</Link>
            </div>
          
            <div className={styles.pathStep}>
              <h3><i className="fa-solid fa-handshake" /> WORK WITH US</h3>
              <p>Coaching, partnerships and building something together.</p>
              <Link href="/work-with-us" className={styles.btnOrange}>EXPLORE</Link>
            </div>
          
            <div className={styles.timeline}>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
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
