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
        <title>Iron Acre</title>
        <meta
          name="description"
          content="Iron Acre is a modern strength brand combining outdoor training, digital coaching, content and community."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </Head>

      <main className={`container py-3 ${styles.page}`}>
        <section className={styles.hero}>
          <div className={styles.heroGrid}>
            <div className={styles.heroCopy}>
              <div className={styles.heroPretitle}>IRON ACRE</div>

              <h1 className={styles.heroTitle}>
                Strength. Conditioning. Community.{" "}
                <span className={styles.heroTitleAccent}>Built different.</span>
              </h1>

              <p className={styles.heroSubtitle}>
                A modern strength brand combining outdoor training, digital coaching, content and a
                different kind of community.
              </p>

              <div className={styles.heroCtas}>
                <Link href={IRON_ACRE_LINKS.appSignup} className="ia-btn ia-btn-primary">
                  Get the app
                </Link>

                <Link href={IRON_ACRE_LINKS.founders} className="ia-btn ia-btn-muted">
                  Explore the gym
                </Link>

                <a
                  href={IRON_ACRE_LINKS.podcast}
                  className="ia-btn ia-btn-outline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Watch the podcast
                </a>
              </div>

              <div className={styles.heroMeta}>
                <div className={`${styles.metaPill} ${styles.metaPillHighlight}`}>
                  Outdoor training
                </div>
                <div className={styles.metaPill}>Digital coaching</div>
                <div className={`${styles.metaPill} ${styles.metaPillWarm}`}>
                  Founding members open
                </div>
              </div>
            </div>

            <div className={styles.heroPanel}>
              <div className={styles.panelCard}>
                <div className={styles.panelKicker}>
                  Built for people who want more than a normal gym
                </div>

                <div className={styles.panelCopy}>
                  Iron Acre exists for people who want real training, real progression and a
                  stronger connection to the way they move, train and live.
                </div>

                <div className={styles.panelStats}>
                  <div className={styles.miniStat}>
                    <div className={styles.miniStatValue}>App</div>
                    <div className={styles.miniStatLabel}>Digital training</div>
                  </div>

                  <div className={styles.miniStat}>
                    <div className={styles.miniStatValue}>Gym</div>
                    <div className={styles.miniStatLabel}>Outdoor sessions</div>
                  </div>

                  <div className={styles.miniStat}>
                    <div className={styles.miniStatValue}>Podcast</div>
                    <div className={styles.miniStatLabel}>Content + community</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <SectionHeader
            kicker="Choose your path"
            title="Start where it makes sense for you"
            subtitle="Iron Acre is bigger than one product. Choose the way in that fits you best."
          />

          <div className="row g-3 mt-1">
            {PATH_CARDS.map((card) => (
              <div key={card.title} className="col-12 col-lg-4">
                <PathCardItem card={card} />
              </div>
            ))}
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <SectionHeader
            kicker="What Iron Acre is"
            title="Built for people who want more than average"
            subtitle="Iron Acre is about better training, clearer progress and a stronger connection to how you live."
          />

          <div className="row g-3 mt-1">
            <div className="col-12 col-md-4">
              <div className={styles.blockCard}>
                <div className={styles.valueTitle}>Train hard</div>
                <div className={styles.valueCopy}>
                  Strength, conditioning and proper sessions that feel purposeful, not generic.
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className={styles.blockCard}>
                <div className={styles.valueTitle}>Track progress</div>
                <div className={styles.valueCopy}>
                  Training is better when you can see momentum, structure and long-term
                  improvement.
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className={styles.blockCard}>
                <div className={styles.valueTitle}>Build consistency</div>
                <div className={styles.valueCopy}>
                  The aim is not noise. The aim is showing up, improving and building something
                  that lasts.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="row g-3 align-items-stretch">
            <div className="col-12 col-lg-6">
              <div className={styles.featureBlock}>
                <div className="ia-kicker">
                  <i className="fas fa-mobile-alt" />
                  Iron Acre App
                </div>

                <div className={styles.featureTitle}>
                  Training, tracking and digital coaching in one place
                </div>

                <div className={styles.featureCopy}>
                  Follow your training, log sessions, track progress and stay connected to the
                  Iron Acre way of training from your phone.
                </div>

                <div className={styles.featureList}>
                  <span>Workout logging</span>
                  <span>Progress tracking</span>
                  <span>Plans and structure</span>
                  <span>Member experience</span>
                </div>

                <div className="mt-3">
                  <Link href={IRON_ACRE_LINKS.appSignup} className="ia-btn ia-btn-primary">
                    Join app waitlist
                  </Link>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-6">
              <div className={`${styles.featureBlock} ${styles.featureAccent}`}>
                <div className="ia-kicker">
                  <i className="fas fa-tree" />
                  Iron Acre Gym
                </div>

                <div className={styles.featureTitle}>
                  Outdoor strength and conditioning with a different atmosphere
                </div>

                <div className={styles.featureCopy}>
                  A more focused, more personal and more real training environment built around
                  strength, conditioning, kettlebells, boxing conditioning and proper community.
                </div>

                <div className={styles.featureList}>
                  <span>Farm Strength</span>
                  <span>Hybrid Fit</span>
                  <span>Kettlebells</span>
                  <span>Boxing Conditioning</span>
                </div>

                <div className="mt-3 d-flex gap-2 flex-wrap">
                  <Link href={IRON_ACRE_LINKS.founders} className="ia-btn ia-btn-primary">
                    Join founding members
                  </Link>

                  <Link href={IRON_ACRE_LINKS.gymInterest} className="ia-btn ia-btn-muted">
                    Register interest
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`ia-tile ia-tile-pad mb-3 ${styles.offerBand}`}>
          <div className="row g-3 align-items-center">
            <div className="col-12 col-lg-8">
              <div className="ia-card-title-compact">Founding Members now open</div>
              <div className="text-dim small mt-2">
                Help shape Iron Acre before launch, influence the timetable and access early member
                offers.
              </div>
              <div className="text-dim small mt-2">
                Refer a friend and if they join as a Founding Member, both of you get your first 2
                months at 50% off.
              </div>
            </div>

            <div className="col-12 col-lg-4 d-flex justify-content-lg-end">
              <Link href={IRON_ACRE_LINKS.founders} className="ia-btn ia-btn-primary">
                Go to founders page
              </Link>
            </div>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="row g-3 align-items-stretch">
            <div className="col-12 col-lg-7">
              <div className={`${styles.featureBlock} ${styles.featureWarm}`}>
                <div className="ia-kicker">
                  <i className="fas fa-podcast" style={{ color: "#FF9E57" }} />
                  Iron Acre Podcast
                </div>

                <div className={styles.featureTitle}>
                  Training, mindset and building something different
                </div>

                <div className={styles.featureCopy}>
                  The podcast is where training, discipline, consistency, recovery, business and
                  the wider Iron Acre mindset will come together.
                </div>

                <div className={`${styles.podcastPlaceholder} mt-3`}>
                  <div className={styles.podcastThumb}>
                    <i className="fab fa-youtube" />
                  </div>
                  <div>
                    <div className={styles.podcastTitle}>Podcast placeholder</div>
                    <div className="text-dim small mt-1">
                      Featured episode block ready for YouTube embed or latest episode link.
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <a
                    href={IRON_ACRE_LINKS.podcast}
                    className="ia-btn ia-btn-primary"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Watch on YouTube
                  </a>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-5">
              <div className={`${styles.featureBlock} ${styles.featureWarm}`}>
                <div className="ia-kicker">
                  <i className="fas fa-share-alt" style={{ color: "#FF9E57" }} />
                  Follow Iron Acre
                </div>

                <div className={styles.featureTitle}>
                  Training clips, launch updates and behind the scenes
                </div>

                <div className={styles.featureCopy}>
                  Follow the journey as Iron Acre grows across the app, the gym, the podcast and
                  the wider brand.
                </div>

                <div className={`${styles.socialGrid} mt-3`}>
                  {SOCIALS.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      className={styles.socialCard}
                      target={social.href.startsWith("http") ? "_blank" : undefined}
                      rel={social.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    >
                      <i className={`fab ${social.icon}`} />
                      <span>{social.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <SectionHeader
            kicker="Founders"
            title="Built by Rob and Nik"
            subtitle="Iron Acre is being built intentionally — not just as a place to train, but as a brand people want to be part of."
          />

          <div className="row g-3 mt-1">
            <div className="col-12 col-lg-6">
              <div className={styles.founderCard}>
                <div className={styles.founderName}>Rob</div>
                <div className={styles.founderRole}>Product, systems and digital build</div>
                <div className={styles.founderCopy}>
                  Focused on the member experience, app, automation, progress tracking and building
                  a premium, modern strength brand from the ground up.
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-6">
              <div className={styles.founderCard}>
                <div className={styles.founderName}>Nik</div>
                <div className={styles.founderRole}>
                  Coaching, training and real-world delivery
                </div>
                <div className={styles.founderCopy}>
                  Focused on coaching, session quality, atmosphere and creating the kind of gym
                  experience people actually want to come back to.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <SectionHeader
            kicker="Early credibility"
            title="Why people are interested"
            subtitle="Iron Acre is already resonating because it offers something more deliberate and more real."
          />

          <div className="row g-3 mt-1">
            <div className="col-12 col-md-4">
              <div className={styles.quoteCard}>
                <div className={styles.quoteMark}>“</div>
                <div className={styles.quoteCopy}>Something different from a normal gym.</div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className={styles.quoteCard}>
                <div className={styles.quoteMark}>“</div>
                <div className={styles.quoteCopy}>Outdoor strength and a better atmosphere.</div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className={styles.quoteCard}>
                <div className={styles.quoteMark}>“</div>
                <div className={styles.quoteCopy}>Training that feels more purposeful.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <SectionHeader kicker="FAQ" title="A few things people will want to know" />

          <div className={`${styles.faqList} mt-2`}>
            {FAQS.map((faq) => (
              <div key={faq.q} className={styles.faqItem}>
                <div className={styles.faqQ}>{faq.q}</div>
                <div className={styles.faqA}>{faq.a}</div>
              </div>
            ))}
          </div>
        </section>

        <footer className={styles.footer}>
          <div className={styles.footerTop}>
            <div>
              <div className={styles.footerTitle}>Iron Acre</div>
              <div className="text-dim small mt-1">
                Strength brand, outdoor training, digital coaching and content.
              </div>
            </div>

            <div className={styles.footerLinks}>
              <Link href={IRON_ACRE_LINKS.appSignup}>App</Link>
              <Link href={IRON_ACRE_LINKS.gymInterest}>Gym</Link>
              <Link href={IRON_ACRE_LINKS.founders}>Founders</Link>
              <a
                href={IRON_ACRE_LINKS.podcast}
                target="_blank"
                rel="noopener noreferrer"
              >
                Podcast
              </a>
              <a href={IRON_ACRE_LINKS.socials.instagram}>Instagram</a>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

