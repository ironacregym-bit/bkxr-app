import Head from "next/head";
import Link from "next/link";
import PathCardItem from "../components/landing/PathCardItem";
import SectionHeader from "../components/landing/SectionHeader";
import { FAQS, PATH_CARDS, SOCIALS } from "../lib/landing/ironAcreLandingContent";
import { IRON_ACRE_LINKS } from "../lib/links/ironAcreLinks";
import styles from "../styles/IronAcreLanding.module.css";

export default function IronAcreLandingPage() {
  return (
    <>
    <Head>
      <title>Iron Acre | Find Your Fire</title>
      <meta
        name="description"
        content="Iron Acre is a modern strength brand built around purposeful training, real progress and a stronger community. Find your fire."
      />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </Head>

     <main className={`container py-3 ${styles.page}`}>
      <section className={styles.logoBar}>
        <div className={styles.logoPlaceholder}>LOGO PLACEHOLDER</div>
      </section>
    
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroPretitle}>IRON ACRE</div>
    
          <h1 className={styles.heroTitle}>
            <span className={styles.heroTitleAccent}>Find Your Fire</span>
          </h1>
    
          <p className={styles.heroLead}>
            Train with more purpose. Build real strength. Be part of something different.
          </p>
    
          <p className={styles.heroSubtitle}>
            Iron Acre is a modern strength brand built around outdoor training, honest coaching,
            digital support and a stronger kind of community.
          </p>
    
          <div className={styles.heroActions}>
            <Link href={IRON_ACRE_LINKS.waitlist} className="ia-btn ia-btn-primary">
              Join the waitlist
            </Link>
    
            <Link href={IRON_ACRE_LINKS.founders} className="ia-btn ia-btn-muted">
              Explore Founding Members
            </Link>
          </div>
    
          <div className={styles.heroMeta}>
            <div className={`${styles.metaPill} ${styles.metaPillHighlight}`}>Training</div>
            <div className={styles.metaPill}>Progress</div>
            <div className={`${styles.metaPill} ${styles.metaPillWarm}`}>Community</div>
          </div>
        </div>
      </section>
    
      <section className={styles.fullSection}>
        <SectionHeader
          kicker="What is Iron Acre"
          title="A modern strength brand built around real progress"
          subtitle="Promise the solution, prove the value and give people a better way to train."
        />
    
        <div className={styles.longformCopy}>
          <p>
            Iron Acre exists for people who are tired of generic fitness. Too many people train without
            structure, without momentum and without a real reason to keep showing up.
          </p>
    
          <p>
            Iron Acre offers a different route through outdoor training, stronger coaching, digital
            support and a community built around purpose, consistency and long-term progress.
          </p>
        </div>
      </section>
    
      <section className={`${styles.fullSection} ${styles.greenSection}`}>
        <SectionHeader
          kicker="Choose your path"
          title="Train with Iron Acre in the way that fits you"
          subtitle="Whether that starts with the app or the gym, there is a clear way in."
        />
    
        <div className={styles.pathRows}>
          <div className={styles.pathRow}>
            <div className={styles.pathCopy}>
              <div className={styles.pathTitle}>Iron Acre App</div>
              <div className={styles.pathBody}>
                Digital coaching, training structure and progress support from your phone.
              </div>
            </div>
    
            <div className={styles.pathAction}>
              <Link href={IRON_ACRE_LINKS.appSignup} className="ia-btn ia-btn-primary">
                App sign up
              </Link>
            </div>
          </div>
    
          <div className={styles.pathRow}>
            <div className={styles.pathCopy}>
              <div className={styles.pathTitle}>Iron Acre Gym</div>
              <div className={styles.pathBody}>
                Outdoor strength and conditioning, kettlebells, boxing conditioning and a better
                atmosphere than a standard gym floor.
              </div>
            </div>
    
            <div className={styles.pathAction}>
              <Link href={IRON_ACRE_LINKS.gymInterest} className="ia-btn ia-btn-primary">
               Yes — here is **just the `<main>...</main>` block** rewritten to match what we agreed:
    
    - **no cards**
    - **full-width sections only**
    - **logo placeholder**
    - **Find Your Fire**
    - **What is Iron Acre**
    - **Choose your path**
    - **Founders**
    - **Email updates**
    - **Social links**
    - green for **app / gym**
    - orange for **founders / podcast / socials**
    - lighter, cleaner structure
    
    Paste this in place of your current `<main>...</main>` block.
    
    ```tsx
    <main className={`container py-3 ${styles.page}`}>
      <section className={styles.logoBar}>
        <div className={styles.logoPlaceholder}>LOGO PLACEHOLDER</div>
      </section>
    
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroPretitle}>IRON ACRE</div>
    
          <h1 className={styles.heroTitle}>
            <span className={styles.heroTitleAccent}>Find Your Fire</span>
          </h1>
    
          <p className={styles.heroLead}>
            Train with more purpose. Build real strength. Be part of something different.
          </p>
    
          <p className={styles.heroSubtitle}>
            Iron Acre is a modern strength brand built around outdoor training, honest coaching,
            digital support and a stronger kind of community.
          </p>
    
          <div className={styles.heroActions}>
            <Link href={IRON_ACRE_LINKS.waitlist} className="ia-btn ia-btn-primary">
              Join the waitlist
            </Link>
    
            <Link href={IRON_ACRE_LINKS.founders} className="ia-btn ia-btn-muted">
              Explore Founding Members
            </Link>
          </div>
        </div>
      </section>
    
      <section className={styles.fullSection}>
        <SectionHeader
          kicker="What is Iron Acre"
          title="A modern strength brand built around real progress"
          subtitle="Promise the solution, prove the value and give people a better way to train."
        />
    
        <div className={styles.longformCopy}>
          <p>
            Iron Acre exists for people who are tired of generic fitness. Too many people train
            without structure, without momentum and without a real reason to keep showing up.
          </p>
    
          <p>
            Iron Acre offers a different route through outdoor training, stronger coaching,
            digital support and a community built around purpose, consistency and long-term
            progress.
          </p>
        </div>
      </section>
    
      <section className={`${styles.fullSection} ${styles.greenSection}`}>
        <SectionHeader
          kicker="Choose your path"
          title="Train with Iron Acre in the way that fits you"
          subtitle="Whether that starts with the app or the gym, there is a clear way in."
        />
    
        <div className={styles.pathRows}>
          <div className={styles.pathRow}>
            <div className={styles.pathCopy}>
              <div className={styles.pathTitle}>Iron Acre App</div>
              <div className={styles.pathBody}>
                Digital coaching, training structure and progress support from your phone.
              </div>
            </div>
    
            <div className={styles.pathAction}>
              <Link href={IRON_ACRE_LINKS.appSignup} className="ia-btn ia-btn-primary">
                App sign up
              </Link>
            </div>
          </div>
    
          <div className={styles.pathRow}>
            <div className={styles.pathCopy}>
              <div className={styles.pathTitle}>Iron Acre Gym</div>
              <div className={styles.pathBody}>
                Outdoor strength and conditioning, kettlebells, boxing conditioning and a better
                atmosphere than a standard gym floor.
              </div>
            </div>
    
            <div className={styles.pathAction}>
              <Link href={IRON_ACRE_LINKS.gymInterest} className="ia-btn ia-btn-primary">
                Register interest
              </Link>
            </div>
          </div>
        </div>
      </section>
    
      <section className={`${styles.fullSection} ${styles.orangeSection}`}>
        <SectionHeader
          kicker="Founders"
          title="Be part of Iron Acre early"
          subtitle="Founding Members help shape the journey, get early access and stay closest to what comes next."
        />
    
        <div className={styles.longformCopy}>
          <p>
            Founding Members are not just joining a gym. They are getting in early, influencing
            the direction of Iron Acre and becoming part of the atmosphere that defines the brand
            from day one.
          </p>
    
          <p>
            If you want something different from standard fitness, this is the best way to get in
            early and be part of what comes next.
          </p>
        </div>
    
        <div className={styles.sectionActions}>
          <Link href={IRON_ACRE_LINKS.founders} className={styles.orangeButton}>
            Explore Founding Members
          </Link>
    
          <Link href={IRON_ACRE_LINKS.waitlist} className={styles.orangeGhostButton}>
            Join the waitlist
          </Link>
        </div>
      </section>
    
      <section className={styles.fullSection}>
        <SectionHeader
          kicker="Email updates"
          title="Drop your email for updates"
          subtitle="Be first to hear about launch updates, Founding Member offers and what is coming next from Iron Acre."
        />
    
        <form className={styles.emailForm}>
          <input
            type="email"
            className={styles.emailInput}
            placeholder="Enter your email"
            aria-label="Email address"
          />
          <button type="submit" className="ia-btn ia-btn-primary">
            Keep me updated
          </button>
        </form>
      </section>
    
      <section className={`${styles.fullSection} ${styles.orangeSection}`}>
        <SectionHeader
          kicker="Follow Iron Acre"
          title="Follow the journey"
          subtitle="Training clips, updates, behind the scenes and what comes next."
        />
    
        <div className={styles.socialRows}>
          <a
            href={IRON_ACRE_LINKS.socials.instagram}
            className={styles.socialRow}
          >
            <div className={styles.socialLeft}>
              <i className={`fab fa-instagram ${styles.socialIcon}`} />
              <span>Instagram</span>
            </div>
            <i className="fas fa-arrow-right" />
          </a>
    
          <a
            href={IRON_ACRE_LINKS.socials.youtube}
            className={styles.socialRow}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className={styles.socialLeft}>
              <i className={`fab fa-youtube ${styles.socialIcon}`} />
              <span>YouTube</span>
            </div>
            <i className="fas fa-arrow-right" />
          </a>
    
          <a
            href={IRON_ACRE_LINKS.socials.facebook}
            className={styles.socialRow}
          >
            <div className={styles.socialLeft}>
              <i className={`fab fa-facebook-f ${styles.socialIcon}`} />
              <span>Facebook</span>
            </div>
            <i className="fas fa-arrow-right" />
          </a>
    
          <a
            href={IRON_ACRE_LINKS.socials.tiktok}
            className={styles.socialRow}
          >
            <div className={styles.socialLeft}>
              <i className={`fab fa-tiktok ${styles.socialIcon}`} />
              <span>TikTok</span>
            </div>
            <i className="fas fa-arrow-right" />
          </a>
        </div>
      </section>
    </main>
    </>
  );
}

