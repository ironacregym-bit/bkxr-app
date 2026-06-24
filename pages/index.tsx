"use client";

import Head from "next/head";
import Link from "next/link";

type PathCard = {
  title: string;
  body: string;
  href: string;
  cta: string;
  icon: string;
  badge?: string;
};

type SocialLink = {
  label: string;
  href: string;
  icon: string;
};

const PATH_CARDS: PathCard[] = [
  {
    title: "Iron Acre App",
    body: "Training, tracking and digital coaching built for real progress.",
    href: "/app-signup",
    cta: "App sign up",
    icon: "fa-mobile-alt",
    badge: "Coming soon",
  },
  {
    title: "Iron Acre Gym",
    body: "Outdoor strength and conditioning with a different kind of atmosphere.",
    href: "/founders",
    cta: "Register interest",
    icon: "fa-dumbbell",
    badge: "Founding Members",
  },
  {
    title: "Iron Acre Podcast",
    body: "Training, mindset, consistency and building something different.",
    href: "https://www.youtube.com/",
    cta: "Watch on YouTube",
    icon: "fa-podcast",
    badge: "Placeholder",
  },
];

const SOCIALS: SocialLink[] = [
  { label: "Instagram", href: "#", icon: "fa-instagram" },
  { label: "YouTube", href: "https://www.youtube.com/", icon: "fa-youtube" },
  { label: "Facebook", href: "#", icon: "fa-facebook-f" },
  { label: "TikTok", href: "#", icon: "fa-tiktok" },
];

const FAQS = [
  {
    q: "Is Iron Acre a gym or an app?",
    a: "Iron Acre is the wider brand. Iron Acre Gym is the in-person training arm and the app is the digital arm, so people can connect with the brand in the way that suits them best.",
  },
  {
    q: "Can I join before launch?",
    a: "Yes. The Founding Members page is the best place to register interest, shape the timetable and access early launch offers.",
  },
  {
    q: "Will the app work without joining the gym?",
    a: "Yes. The long-term aim is for Iron Acre App users to get value whether they train with us in person or not.",
  },
  {
    q: "What kind of training does Iron Acre focus on?",
    a: "Strength, conditioning, kettlebells, outdoor sessions, consistency and proper long-term progress rather than gimmicks.",
  },
];

function SectionHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="ia-section-header">
      <div className="ia-kicker">
        <i className="fas fa-circle-notch ia-kicker-dot" />
        {kicker}
      </div>
      <h2 className="ia-section-title">{title}</h2>
      {subtitle ? <p className="ia-section-subtitle">{subtitle}</p> : null}
    </div>
  );
}

function PathCardItem({ card }: { card: PathCard }) {
  const content = (
    <div className="ia-brand-path-card">
      <div className="ia-brand-path-top">
        <div className="ia-brand-icon-wrap">
          <i className={`fas ${card.icon}`} />
        </div>
        {card.badge ? <span className="ia-brand-badge">{card.badge}</span> : null}
      </div>

      <div className="ia-brand-path-title">{card.title}</div>
      <div className="ia-brand-path-body">{card.body}</div>

      <div className="ia-brand-path-link">
        {card.cta}
        <i className="fas fa-arrow-right" />
      </div>
    </div>
  );

if (card.href.startsWith("http")) {
  -link-no-underline"  return (
        target="_blank"
        rel="noopener noreferrer"
      >
        {content}
      </a>
    );
  }
    <a
      href={card.href}
  return (
    {card.href}
      {content}
    </Link>
  );
}

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

      <main className="container py-3 ia-brand-page">
        <section className="ia-brand-hero">
          <div className="ia-brand-hero-grid">
            <div className="ia-brand-hero-copy">
              <div className="ia-brand-pretitle">IRON ACRE</div>
              <h1 className="ia-brand-hero-title">
                Strength. Conditioning. Community. Built different.
              </h1>
              <p className="ia-brand-hero-subtitle">
                A modern strength brand combining outdoor training, digital coaching, content and a
                different kind of community.
              </p>

              <div className="ia-brand-hero-ctas">
                /app-signup
                  Get the app
                </Link>

                /founders
                  Explore the gym
                </Link>

                https://www.youtube.com/
                  Watch the podcast
                </a>
              </div>

              <div className="ia-brand-hero-meta">
                <div className="ia-brand-meta-pill">Outdoor training</div>
                <div className="ia-brand-meta-pill">Digital coaching</div>
                <div className="ia-brand-meta-pill">Founding members open</div>
              </div>
            </div>

            <div className="ia-brand-hero-panel">
              <div className="ia-brand-panel-card">
                <div className="ia-brand-panel-kicker">
                  Built for people who want more than a normal gym
                </div>
                <div className="ia-brand-panel-copy">
                  Iron Acre exists for people who want real training, real progression and a stronger
                  connection to the way they move, train and live.
                </div>

                <div className="ia-brand-panel-stats">
                  <div className="ia-brand-mini-stat">
                    <div className="ia-brand-mini-stat-value">App</div>
                    <div className="ia-brand-mini-stat-label">Digital training</div>
                  </div>
                  <div className="ia-brand-mini-stat">
                    <div className="ia-brand-mini-stat-value">Gym</div>
                    <div className="ia-brand-mini-stat-label">Outdoor sessions</div>
                  </div>
                  <div className="ia-brand-mini-stat">
                    <div className="ia-brand-mini-stat-value">Podcast</div>
                    <div className="ia-brand-mini-stat-label">Content + community</div>
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
              <div className="ia-value-card">
                <div className="ia-value-title">Train hard</div>
                <div className="ia-value-copy">
                  Strength, conditioning and proper sessions that feel purposeful, not generic.
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="ia-value-card">
                <div className="ia-value-title">Track progress</div>
                <div className="ia-value-copy">
                  Training is better when you can see momentum, structure and long-term improvement.
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="ia-value-card">
                <div className="ia-value-title">Build consistency</div>
                <div className="ia-value-copy">
                  The aim is not noise. The aim is showing up, improving and building something that lasts.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="row g-3 align-items-stretch">
            <div className="col-12 col-lg-6">
              <div className="ia-feature-block h-100">
                <div className="ia-kicker">
                  <i className="fas fa-mobile-alt" />
                  Iron Acre App
                </div>
                <div className="ia-feature-title">
                  Training, tracking and digital coaching in one place
                </div>
                <div className="ia-feature-copy">
                  Follow your training, log sessions, track progress and stay connected to the Iron Acre
                  way of training from your phone.
                </div>

                <div className="ia-feature-list">
                  <span>Workout logging</span>
                  <span>Progress tracking</span>
                  <span>Plans and structure</span>
                  <span>Member experience</span>
                </div>

                <div className="mt-3">
                  /app-signup
                    Join app waitlist
                  </Link>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-6">
              <div className="ia-feature-block h-100 ia-feature-block-accent">
                <div className="ia-kicker">
                  <i className="fas fa-tree" />
                  Iron Acre Gym
                </div>
                <div className="ia-feature-title">
                  Outdoor strength and conditioning with a different atmosphere
                </div>
                <div className="ia-feature-copy">
                  A more focused, more personal and more real training environment built around strength,
                  conditioning, kettlebells, boxing conditioning and proper community.
                </div>

                <div className="ia-feature-list">
                  <span>Farm Strength</span>
                  <span>Hybrid Fit</span>
                  <span>Kettlebells</span>
                  <span>Boxing Conditioning</span>
                </div>

                <div className="mt-3 d-flex gap-2 flex-wrap">
                  /founders
                    Join founding members
                  </Link>
                  /founders
                    Register interest
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3 ia-founders-offer-band">
          <div className="row g-3 align-items-center">
            <div className="col-12 col-lg-8">
              <div className="ia-card-title-compact">Founding Members now open</div>
              <div className="text-dim small mt-2">
                Help shape Iron Acre before launch, influence the timetable and access early member offers.
              </div>
              <div className="text-dim small mt-2">
                Refer a friend and if they join as a Founding Member, both of you get your first 2 months at 50% off.
              </div>
            </div>

            <div className="col-12 col-lg-4 d-flex justify-content-lg-end">
              /founders
                Go to founders page
              </Link>
            </div>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <div className="row g-3 align-items-stretch">
            <div className="col-12 col-lg-7">
              <div className="ia-feature-block h-100">
                <div className="ia-kicker">
                  <i className="fas fa-podcast" />
                  Iron Acre Podcast
                </div>
                <div className="ia-feature-title">
                  Training, mindset and building something different
                </div>
                <div className="ia-feature-copy">
                  The podcast is where training, discipline, consistency, recovery, business and the wider
                  Iron Acre mindset will come together.
                </div>

                <div className="ia-podcast-placeholder mt-3">
                  <div className="ia-podcast-thumb">
                    <i className="fab fa-youtube" />
                  </div>
                  <div>
                    <div className="ia-podcast-title">Podcast placeholder</div>
                    <div className="text-dim small mt-1">
                      Featured episode block ready for YouTube embed or latest episode link.
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  https://www.youtube.com/
                    Watch on YouTube
                  </a>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-5">
              <div className="ia-feature-block h-100">
                <div className="ia-kicker">
                  <i className="fas fa-share-alt" />
                  Follow Iron Acre
                </div>
                <div className="ia-feature-title">
                  Training clips, launch updates and behind the scenes
                </div>
                <div className="ia-feature-copy">
                  Follow the journey as Iron Acre grows across the app, the gym, the podcast and the wider brand.
                </div>

                <div className="ia-social-grid mt-3">
                  {SOCIALS.map((social) => (
                    {social.href} ? "_blank" : undefined}
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
              <div className="ia-founder-card">
                <div className="ia-founder-name">Rob</div>
                <div className="ia-founder-role">Product, systems and digital build</div>
                <div className="ia-founder-copy">
                  Focused on the member experience, app, automation, progress tracking and building a premium,
                  modern strength brand from the ground up.
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-6">
              <div className="ia-founder-card">
                <div className="ia-founder-name">Nik</div>
                <div className="ia-founder-role">Coaching, training and real-world delivery</div>
                <div className="ia-founder-copy">
                  Focused on coaching, session quality, atmosphere and creating the kind of gym experience
                  people actually want to come back to.
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
              <div className="ia-quote-card">
                <div className="ia-quote-mark">“</div>
                <div className="ia-quote-copy">
                  Something different from a normal gym.
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="ia-quote-card">
                <div className="ia-quote-mark">“</div>
                <div className="ia-quote-copy">
                  Outdoor strength and a better atmosphere.
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="ia-quote-card">
                <div className="ia-quote-mark">“</div>
                <div className="ia-quote-copy">
                  Training that feels more purposeful.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ia-tile ia-tile-pad mb-3">
          <SectionHeader kicker="FAQ" title="A few things people will want to know" />

          <div className="ia-faq-list mt-2">
            {FAQS.map((faq) => (
              <div key={faq.q} className="ia-faq-item">
                <div className="ia-faq-q">{faq.q}</div>
                <div className="ia-faq-a">{faq.a}</div>
              </div>
            ))}
          </div>
        </section>

        <footer className="ia-brand-footer">
          <div className="ia-brand-footer-top">
            <div>
              <div className="ia-brand-footer-title">Iron Acre</div>
              <div className="text-dim small mt-1">
                Strength brand, outdoor training, digital coaching and content.
              </div>
            </div>

            <div className="ia-brand-footer-links">
              /app-signupApp</Link>
              /foundersGym</Link>
              /foundersFounders</Link>
              https://www.youtube.com/
                Podcast
              </a>
              #Instagram</a>
            </div>
          </div>
        </footer>
      </main>

      <style jsx>{`
        .ia-brand-page {
          padding-bottom: 48px;
        }

        .ia-brand-hero {
          margin-bottom: 16px;
          border-radius: 28px;
          overflow: hidden;
          background:
            radial-gradient(circle at top right, rgba(35, 255, 150, 0.14), transparent 26%),
            linear-gradient(180deg, rgba(8, 12, 18, 0.98) 0%, rgba(4, 8, 13, 1) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
        }

        .ia-brand-hero-grid {
          display: grid;
          grid-template-columns: 1.25fr 0.95fr;
          gap: 20px;
          padding: 28px;
        }

        .ia-brand-hero-copy {
          min-width: 0;
        }

        .ia-brand-pretitle {
          display: inline-block;
          color: var(--ia-neon, #23ff96);
          font-size: 0.82rem;
          font-weight: 800;
          letter-spacing: 0.12em;
        }

        .ia-brand-hero-title {
          margin: 14px 0 0;
          font-size: clamp(2.2rem, 5vw, 4rem);
          line-height: 0.98;
          letter-spacing: -0.04em;
          font-weight: 900;
          color: #ffffff;
        }

        .ia-brand-hero-subtitle {
          margin: 16px 0 0;
          max-width: 620px;
          font-size: 1rem;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.82);
        }

        .ia-brand-hero-ctas {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 22px;
        }

        .ia-brand-hero-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 18px;
        }

        .ia-brand-meta-pill {
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          padding: 0 12px;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.86);
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
        }

        .ia-brand-hero-panel {
          display: flex;
          align-items: stretch;
        }

        .ia-brand-panel-card {
          width: 100%;
          border-radius: 22px;
          padding: 18px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .ia-brand-panel-kicker {
          color: var(--ia-neon, #23ff96);
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .ia-brand-panel-copy {
          margin-top: 12px;
          color: rgba(255, 255, 255, 0.88);
          line-height: 1.6;
          font-size: 0.96rem;
        }

        .ia-brand-panel-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 18px;
        }

        .ia-brand-mini-stat {
          border-radius: 16px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .ia-brand-mini-stat-value {
          color: #ffffff;
          font-weight: 800;
          font-size: 0.92rem;
        }

        .ia-brand-mini-stat-label {
          margin-top: 6px;
          color: rgba(255, 255, 255, 0.62);
          font-size: 0.78rem;
          line-height: 1.35;
        }

        .ia-section-header {
          margin-bottom: 8px;
        }

        .ia-section-title {
          margin: 10px 0 0;
          color: #ffffff;
          font-size: clamp(1.5rem, 2.6vw, 2.2rem);
          line-height: 1.05;
          letter-spacing: -0.03em;
          font-weight: 900;
        }

        .ia-section-subtitle {
          margin: 10px 0 0;
          color: rgba(255, 255, 255, 0.72);
          line-height: 1.6;
          max-width: 780px;
        }

        .ia-kicker-dot {
          font-size: 0.55rem;
          color: var(--ia-neon, #23ff96);
        }

        .ia-brand-path-card {
          height: 100%;
          border-radius: 20px;
          padding: 16px;
          background:
            linear-gradient(180deg, rgba(10, 14, 20, 0.94) 0%, rgba(7, 11, 17, 0.98) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
          transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
        }

        .ia-brand-path-card:hover {
          transform: translateY(-2px);
          border-color: rgba(35, 255, 150, 0.2);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            0 14px 30px rgba(0, 0, 0, 0.18);
        }

        .ia-brand-path-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .ia-brand-icon-wrap {
          width: 42px;
          height: 42px;
          border-radius: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(35, 255, 150, 0.1);
          border: 1px solid rgba(35, 255, 150, 0.16);
          color: var(--ia-neon, #23ff96);
          font-size: 1rem;
        }

        .ia-brand-badge {
          display: inline-flex;
          align-items: center;
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(191, 227, 255, 0.1);
          color: var(--ia-info-text, #bfe3ff);
          border: 1px solid rgba(191, 227, 255, 0.16);
          font-size: 0.74rem;
          font-weight: 700;
        }

        .ia-brand-path-title {
          margin-top: 16px;
          color: #ffffff;
          font-size: 1.08rem;
          line-height: 1.2;
          font-weight: 800;
        }

        .ia-brand-path-body {
          margin-top: 10px;
          color: rgba(255, 255, 255, 0.72);
          line-height: 1.5;
          font-size: 0.92rem;
        }

        .ia-brand-path-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          color: var(--ia-neon, #23ff96);
          font-weight: 700;
          font-size: 0.88rem;
        }

        .ia-value-card,
        .ia-quote-card,
        .ia-founder-card,
        .ia-feature-block {
          height: 100%;
          border-radius: 18px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ia-value-title,
        .ia-feature-title,
        .ia-founder-name {
          color: #ffffff;
          font-weight: 800;
          letter-spacing: -0.01em;
        }

        .ia-value-title {
          font-size: 1rem;
        }

        .ia-value-copy,
        .ia-feature-copy,
        .ia-founder-copy,
        .ia-faq-a,
        .ia-quote-copy {
          margin-top: 10px;
          color: rgba(255, 255, 255, 0.72);
          line-height: 1.6;
          font-size: 0.92rem;
        }

        .ia-feature-block-accent {
          background:
            radial-gradient(circle at top right, rgba(35, 255, 150, 0.08), transparent 34%),
            rgba(255, 255, 255, 0.04);
        }

        .ia-feature-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 14px;
        }

        .ia-feature-list span {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.86);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ia-founders-offer-band {
          border: 1px solid rgba(35, 255, 150, 0.16);
          background:
            linear-gradient(180deg, rgba(11, 17, 21, 0.98) 0%, rgba(7, 12, 16, 1) 100%);
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.15);
        }

        .ia-podcast-placeholder {
          display: flex;
          gap: 14px;
          align-items: center;
          border-radius: 16px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ia-podcast-thumb {
          width: 76px;
          height: 76px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.05);
          color: #ff4040;
          font-size: 1.9rem;
          flex-shrink: 0;
        }

        .ia-podcast-title {
          color: #ffffff;
          font-weight: 800;
          font-size: 1rem;
        }

        .ia-social-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .ia-social-card {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 48px;
          padding: 0 14px;
          border-radius: 14px;
          text-decoration: none;
          color: #ffffff;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: border-color 0.16s ease, transform 0.16s ease;
        }

        .ia-social-card:hover {
          transform: translateY(-1px);
          border-color: rgba(35, 255, 150, 0.18);
        }

        .ia-social-card i {
          color: var(--ia-neon, #23ff96);
          width: 18px;
          text-align: center;
        }

        .ia-founder-role {
          margin-top: 6px;
          color: var(--ia-neon, #23ff96);
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.02em;
        }

        .ia-quote-card {
          position: relative;
        }

        .ia-quote-mark {
          color: rgba(35, 255, 150, 0.35);
          font-size: 2rem;
          font-weight: 900;
          line-height: 1;
        }

        .ia-faq-list {
          display: grid;
          gap: 12px;
        }

        .ia-faq-item {
          border-radius: 16px;
          padding: 14px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ia-faq-q {
          color: #ffffff;
          font-weight: 800;
          font-size: 0.96rem;
        }

        .ia-brand-footer {
          margin-top: 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding: 18px 4px 0;
        }

        .ia-brand-footer-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 18px;
          flex-wrap: wrap;
        }

        .ia-brand-footer-title {
          color: #ffffff;
          font-weight: 900;
          letter-spacing: -0.02em;
          font-size: 1rem;
        }

        .ia-brand-footer-links {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
        }

        .ia-brand-footer-links :global(a) {
          color: rgba(255, 255, 255, 0.72);
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 600;
        }

        .ia-brand-footer-links :global(a:hover) {
          color: var(--ia-neon, #23ff96);
        }

        @media (max-width: 991px) {
          .ia-brand-hero-grid {
            grid-template-columns: 1fr;
            padding: 22px;
          }

          .ia-brand-panel-stats {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 767px) {
          .ia-brand-hero {
            border-radius: 22px;
          }

          .ia-brand-hero-grid {
            padding: 18px;
          }

          .ia-brand-hero-title {
            font-size: 2.4rem;
          }

          .ia-social-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
