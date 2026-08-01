//join.tsx
import Image from "next/image";
import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";


type ApiResp =
  | { ok: true; existed: boolean }
  | { ok: false; error: string; detail?: string };

function getStr(q: any): string {
  if (typeof q === "string") return q;
  if (Array.isArray(q) && q.length) return String(q[0] || "");
  return "";
}

function normEmail(v: string) {
  return v.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function WaitlistPage() {
  const router = useRouter();
  const formRef = useRef<HTMLDivElement | null>(null);

  const [email, setEmail] = useState("");
  const [foundersInterest, setFoundersInterest] = useState(true);

  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const utm = useMemo(() => {
    const q = router.query || {};
    return {
      utm_source: getStr((q as any).utm_source),
      utm_medium: getStr((q as any).utm_medium),
      utm_campaign: getStr((q as any).utm_campaign),
      utm_content: getStr((q as any).utm_content),
      utm_term: getStr((q as any).utm_term),
    };
  }, [router.query]);

  useEffect(() => {
    if (!router.isReady) return;
    const maybeEmail = getStr((router.query as any).email);
    if (maybeEmail && !email) setEmail(maybeEmail);
  }, [router.isReady, router.query, email]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  function scrollToForm() {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function submit() {
    setError(null);

    const e = normEmail(email);
    if (!e || !isValidEmail(e)) {
      setError("Enter a valid email.");
      return;
    }

    setLoading(true);

    try {
      const resp = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          email: e,
          founders_interest: foundersInterest,
          consent: true,
          utm,
          referrer: typeof document !== "undefined" ? document.referrer : "",
        }),
      });

      const data = (await resp.json().catch(() => null)) as ApiResp | null;

      if (!resp.ok || !data || (data as any).ok !== true) {
        const err = (data as any)?.error || "Something went wrong.";
        setError(
          err === "RATE_LIMITED"
            ? "Too many attempts. Try again in a few minutes."
            : "Could not join. Try again."
        );
        setLoading(false);
        return;
      }

      router.push(
        `/waitlist/thanks?email=${encodeURIComponent(e)}&founders=${foundersInterest ? "1" : "0"}`
      );
    } catch {
      setError("Could not join. Try again.");
      setLoading(false);
    }
  }

  const heroImageSrc = "/concept-3.jpg";
  const concept2Src = "/concept-2.jpg";
  const logoSrc = "/iron_acre_logo_transparent.png";

  return (
    <>
      <Head>
        <title>Iron Acre Gym </title>
        <meta
          name="description"
          content="Train hard. Be outside. Build something real. Founders £60/month locked for life for the first 20."
        />
        <meta property="og:title" content="Iron Acre Gym | Founders" />
        <meta
          property="og:description"
          content="Train hard. Be outside. Build something real. OPEN NOW • Early Access Pricing • £8 Per Session For Life"
        />
        <meta property="og:type" content="website" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="wrap">
        <section className="hero" aria-label="Iron Acre Gym">
          <div className="heroMedia" aria-hidden="true">
            <Image
              src={heroImageSrc}
              alt=""
              fill
              priority
              sizes="100vw"
              style={{ objectFit: "cover", objectPosition: "50% 55%" }}
            />
          </div>

          <div className="heroOverlay" aria-hidden="true" />

          <header className="heroTop">
            <div
              className="brand"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              role="button"
              tabIndex={0}
              aria-label="Back to top"
            >
              <span className="brandLogo" aria-hidden="true">
                <Image
                  src={logoSrc}
                  alt=""
                  width={40}
                  height={40}
                  style={{ objectFit: "contain" }}
                  priority
                />
              </span>
              <span className="brandText">Iron Acre Gym</span>
            </div>

            <nav className="heroNav heroNavDesktop" aria-label="Page sections">
              <button type="button" className="navLink" onClick={() => scrollToId("Pricing")}>
                Founders
              </button>
              <button type="button" className="navLink" onClick={() => scrollToId("about")}>
                About
              </button>
              <button type="button" className="navLink" onClick={() => scrollToId("Methodology")}>
                Classes
              </button>
              <button type="button" className="navLink" onClick={() => scrollToId("benefits")}>
                Benefits
              </button>
              <button type="button" className="navLink" onClick={() => scrollToId("faq")}>
                FAQ
              </button>
              <button type="button" className="navLink" onClick={() => scrollToId("contact")}>
                Contact
              </button>
            </nav>

            <button
              type="button"
              className="menuBtn heroNavMobile"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="menuIcon" aria-hidden="true" />
            </button>
          </header>

          {menuOpen ? (
            <div className="mobileMenu" role="dialog" aria-modal="true" aria-label="Menu">
              <button
                type="button"
                className="mobileMenuBackdrop"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
              />

              <div className="mobileMenuPanel">
                <div className="mobileMenuTitle">Menu</div>

                <button
                  type="button"
                  className="mobileMenuLink"
                  onClick={() => {
                    setMenuOpen(false);
                    scrollToId("founders");
                  }}
                >
                  Founders
                </button>

                <button
                  type="button"
                  className="mobileMenuLink"
                  onClick={() => {
                    setMenuOpen(false);
                    scrollToId("about");
                  }}
                >
                  About
                </button>

                <button
                  type="button"
                  className="mobileMenuLink"
                  onClick={() => {
                    setMenuOpen(false);
                    scrollToId("classes");
                  }}
                >
                  Classes
                </button>

                <button
                  type="button"
                  className="mobileMenuLink"
                  onClick={() => {
                    setMenuOpen(false);
                    scrollToId("benefits");
                  }}
                >
                  Benefits
                </button>

                <button
                  type="button"
                  className="mobileMenuLink"
                  onClick={() => {
                    setMenuOpen(false);
                    scrollToId("next");
                  }}
                >
                  What’s Next
                </button>

                <button
                  type="button"
                  className="mobileMenuLink"
                  onClick={() => {
                    setMenuOpen(false);
                    scrollToId("faq");
                  }}
                >
                  FAQ
                </button>

                <button
                  type="button"
                  className="mobileMenuLink"
                  onClick={() => {
                    setMenuOpen(false);
                    scrollToId("contact");
                  }}
                >
                  Contact
                </button>

                <button
                  type="button"
                  className="ia-btn ia-btn-primary mobileMenuCta"
                  onClick={() => {
                    setMenuOpen(false);
                    scrollToForm();
                  }}
                >
                  Enquire About A Class
                </button>
              </div>
            </div>
          ) : null}

          <div className="heroInner">
            <div className="heroLeft">
              <div className="heroEyebrow">IRON ACRE GYM</div>

              <h1 className="headline">
                Train Hard
                <br />
                Be Outside
                <br />
                Build Something Real
              </h1>

              <div className="differentiators" aria-label="Brand differentiators">
                <span className="diffChip">Strength</span>
                <span className="diffChip">Community</span>
                <span className="diffChip">Outdoors</span>
              </div>

              <div className="badgeRow">
                <div className="badge">
                  OPEN NOW • Early Access Pricing • £8 Per Session For Life
                </div>
              </div>
            </div>

            <div className="formCard ia-tile ia-tile-pad">
              <div className="formTitle">
                Enquire About A Class
              </div>
            
              <div className="formSub">
                Farm Strong currently runs Mondays and Wednesdays from 6:30pm to 7:30pm.
              </div>
            
              <div className="formGrid">
                <button
                  type="button"
                  className="ia-btn ia-btn-primary formBtn"
                  onClick={() =>
                    window.open(
                      "https://wa.me/447000000000?text=Hi%20I'm%20interested%20in%20attending%20one%20of%20your%20Farm%20Strong%20classes.",
                      "_blank"
                    )
                  }
                >
                  Enquire About A Class
                </button>
            
                <div className="finePrint">
                  £8 per session for life during our early access phase.
                  Standard pricing will be £12 per session.
                </div>
              </div>
            </div>
          </div>

          <div className="heroScrollHint" aria-hidden="true" />
        </section>

        <main className="main">
          <section id="about" className="section">
            <div className="sectionHead">
              <div className="sectionEyebrow">ABOUT IRON ACRE</div>
              <h2 className="sectionTitle">This is the gym people actually want to train at.</h2>
            </div>

            <div className="grid2">
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Built for people who want more</div>
                <div className="cardText">
                  Iron Acre Gym is built for people who want more from their training.
                  <br />
                  <br />
                  You’ll train with woodland behind you and open meadow out in front, surrounded by a setting that
                  actually makes you want to show up.
                  <br />
                  <br />
                  Sunrise sessions that set the tone for your entire day.
                  <br />
                  Sunset sessions that feel earned.
                  <br />
                  <br />
                  This isn’t just somewhere you train.
                  <br />
                  It’s somewhere you want to be.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Not another outdoor bootcamp</div>
                <div className="cardText">
                  Iron Acre is not another outdoor bootcamp gym built on random circuits and burnout sessions.
                  We believe in proper progression, real coaching, and training that actually improves you over time.
                  Every class has structure. Every session has a point. The goal is simple: make you stronger, fitter
                  and more capable without wasting your time.
                </div>
              </div>
            </div>

            <div className="conceptWrap ia-tile" aria-hidden="true">
              <Image
                src={concept2Src}
                alt=""
                fill
                sizes="100vw"
                style={{ objectFit: "cover", objectPosition: "50% 55%" }}
              />
              <div className="conceptOverlay" aria-hidden="true" />
              <div className="conceptCaption">
                Strength, Community, Outdoors.
              </div>
            </div>
          </section>

          <section id="classes" className="section">
            <div className="sectionHead">
              <div className="sectionEyebrow">
                PROGRAMMING
              </div>
          
              <h2 className="sectionTitle">
                Farm Strong
              </h2>
          
              <p className="sectionSub">
                Functional bodybuilding meets strength and conditioning.
              </p>
            </div>
          
            <div className="grid2">
              <div
                className="card ia-tile ia-tile-pad"
                style={{
                  gridColumn: "1 / -1",
                }}
              >
                <div className="cardTitle">
                  Farm Strong
                </div>
          
                <div className="cardText">
                  Farm Strong combines the muscle-building principles of
                  functional bodybuilding with the fitness-building principles
                  of strength and conditioning.
                  <br />
                  <br />
                  The goal isn't simply to get tired.
                  <br />
                  <br />
                  The goal is to build the strongest, fittest and most capable
                  version of yourself.
                  <br />
                  <br />
                  Every training block follows structured progression focused on:
                  <br />
                  <br />
                  • Building lean muscle
                  <br />
                  • Increasing strength
                  <br />
                  • Improving conditioning
                  <br />
                  • Developing athleticism
                  <br />
                  • Creating long-term progress
                  <br />
                  <br />
                  Expect sled work, sandbags, carries, kettlebells,
                  bodyweight movements and progressive strength work delivered
                  through a system that gives you purpose every time you train.
                  <br />
                  <br />
                  Every session has a reason.
                  <br />
                  Every block has progression.
                  <br />
                  Every member knows what they're working towards.
                </div>
          
                <div
                  style={{
                    marginTop: 18,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <span className="diffChip">
                    Functional Bodybuilding
                  </span>
          
                  <span className="diffChip">
                    Strength
                  </span>
          
                  <span className="diffChip">
                    Conditioning
                  </span>
          
                  <span className="diffChip">
                    Progression
                  </span>
                </div>
          
                <div
                  style={{
                    marginTop: 18,
                    padding: 14,
                    borderRadius: 14,
                    background: "rgba(24,255,154,.08)",
                    border: "1px solid rgba(24,255,154,.18)",
                  }}
                >
                  <div
                    style={{
                      color: "#18ff9a",
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    Current Session Times
                  </div>
          
                  <div>
                    Monday • 6:30pm - 7:30pm
                  </div>
          
                  <div>
                    Wednesday • 6:30pm - 7:30pm
                  </div>
                </div>
              </div>
            </div>
          </section>
          <section id="benefits" className="section">
            <div className="sectionHead">
              <div className="sectionEyebrow">MEMBERSHIP</div>
              <h2 className="sectionTitle">Benefits</h2>
              <p className="sectionSub">More than classes. A full training system.</p>
            </div>

            <div className="grid2">
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">
                  Expert Coaching
                </div>
            
                <div className="cardText">
                  Every session is coached from start to finish so you
                  always know what you're doing and why.
                </div>
              </div>
            
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">
                  Structured Programming
                </div>
            
                <div className="cardText">
                  Every block follows progression and has a purpose.
                  No random workouts. No guesswork.
                </div>
              </div>
            
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">
                  Outdoor Environment
                </div>
            
                <div className="cardText">
                  Train surrounded by woodland and open countryside in
                  a space you'll actually want to show up to.
                </div>
              </div>
            
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">
                  Iron Acre App
                </div>
            
                <div className="cardText">
                  Track training, bodyweight, performance and progress
                  directly through the Iron Acre app.
                </div>
              </div>
            </div>
          </section>
          <section id="faq" className="section">
            <div className="sectionHead">
              <div className="sectionEyebrow">QUESTIONS</div>
              <h2 className="sectionTitle">FAQ</h2>
              <p className="sectionSub">Quick answers. No fluff.</p>
            </div>

            <div className="grid2">
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">
                  Expert Coaching
                </div>
            
                <div className="cardText">
                  Every session is coached from start to finish so you
                  always know what you're doing and why.
                </div>
              </div>
            
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">
                  Structured Programming
                </div>
            
                <div className="cardText">
                  Every block follows progression and has a purpose.
                  No random workouts. No guesswork.
                </div>
              </div>
            
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">
                  Outdoor Environment
                </div>
            
                <div className="cardText">
                  Train surrounded by woodland and open countryside in
                  a space you'll actually want to show up to.
                </div>
              </div>
            
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">
                  Iron Acre App
                </div>
            
                <div className="cardText">
                  Track training, bodyweight, performance and progress
                  directly through the Iron Acre app.
                </div>
              </div>
            </div>
          </section>

          <section id="contact" className="section">
            <div className="sectionHead">
              <div className="sectionEyebrow">READY TO JOIN?</div>
              <h2 className="sectionTitle">Contact</h2>
              <p className="sectionSub">Join the Acre and we’ll keep you in the loop by email.</p>
            </div>

            <div className="contactCard ia-tile ia-tile-pad">
              <div className="contactRow">
                <div className="contactLabel">Best next step</div>
                  <button
                    type="button"
                    className="ia-btn ia-btn-primary"
                    onClick={() =>
                      window.open(
                        "https://wa.me/447860861120?text=Hi%20I'm%20interested%20in%20attending%20one%20of%20your%20Farm%20Strong%20classes.",
                        "_blank"
                      )
                    }
                  >
                    Enquire About A Class
                  </button>
              </div>
              <div className="contactFoot">
                Farm Strong currently runs Mondays and Wednesdays from
                6:30pm to 7:30pm. Early access pricing is £8 per session
                for life.
              </div>
            </div>
          </section>

          <footer className="footer">
            <div className="footerInner">
              <div>© {new Date().getFullYear()} Iron Acre Gym</div>
              <div className="footerLinks">
                <button type="button" className="footerLink" onClick={() => scrollToId("founders")}>
                  Founders
                </button>
                <button type="button" className="footerLink" onClick={() => scrollToId("classes")}>
                  Classes
                </button>
                <button type="button" className="footerLink" onClick={() => scrollToId("contact")}>
                  Contact
                </button>
              </div>
            </div>
          </footer>
        </main>

        <style jsx>{`
         
        `}</style>
      </div>
    </>
  );
}
