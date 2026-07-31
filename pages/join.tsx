// File: pages/waitlist.tsx
import Image from "next/image";
import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import styles from "../styles/join.module.css";

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
          content="Train hard. Be outside. Build something real. Founders £60/month locked for life for the first 20."
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
              <button type="button" className="navLink" onClick={() => scrollToId("founders")}>
                Founders
              </button>
              <button type="button" className="navLink" onClick={() => scrollToId("about")}>
                About
              </button>
              <button type="button" className="navLink" onClick={() => scrollToId("classes")}>
                Classes
              </button>
              <button type="button" className="navLink" onClick={() => scrollToId("benefits")}>
                Benefits
              </button>
              <button type="button" className="navLink" onClick={() => scrollToId("next")}>
                What’s Next
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
                  Join the Acre
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
                <div className="badge">Founders £60/month locked for life • first 20 only</div>
              </div>
            </div>

            <div className="heroRight" ref={formRef}>
              <div className="formCard ia-tile ia-tile-pad">
                <div className="formTitle">Join the Acre</div>
                <div className="formSub">
                  One email. Early access. Founders get invited first.
                </div>

                <div className="formGrid">
                  <input
                    className="form-control formInput"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />

                  <label className="checkRow">
                    <input
                      type="checkbox"
                      checked={foundersInterest}
                      onChange={(e) => setFoundersInterest(e.target.checked)}
                    />
                    <span>I want a founders spot (£60/month locked for life)</span>
                  </label>

                  {error ? <div className="formError">{error}</div> : null}

                  <button
                    type="button"
                    className="ia-btn ia-btn-primary formBtn"
                    disabled={loading}
                    onClick={submit}
                  >
                    {loading ? "Joining…" : "Join the Acre"}
                  </button>

                  <div className="finePrint">
                    Standard membership will be £100/month. No payment is taken until one month after opening.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="heroScrollHint" aria-hidden="true" />
        </section>

        <main className="main">
          <section id="founders" className="section">
            <div className="sectionHead">
              <div className="sectionEyebrow">FOUNDING OFFER</div>
              <h2 className="sectionTitle">Founding Members</h2>
              <p className="sectionSub">
                Get in early. Pay less forever. Be part of what Iron Acre becomes from day one.
              </p>
            </div>

            <div className="grid2">
              <div className="card ia-tile ia-tile-pad cardFounders">
                <div className="cardTitle cardTitleAccent">£60 a month for life</div>
                <div className="cardText">
                  The first 20 members lock in at <strong>£60 a month for life</strong>. After that, membership moves
                  to <strong>£100 a month</strong>. If you know you want in, this is the moment to move.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad cardFounders">
                <div className="cardTitle">More than just a lower price</div>
                <div className="cardText">
                  Founding members get <strong>priority access to sessions</strong>, <strong>early access before public launch</strong>,
                  and an invite to the <strong>opening BBQ</strong>. More importantly, you get to be part of the group
                  that shapes the culture of the gym from the very start.
                </div>
              </div>
            </div>
          </section>

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
                <div className="cardTitle">Coach led sessions</div>
                <div className="cardText">
                  Every session is coached with intent. You are not left guessing. You get structure, feedback and
                  progression built into the experience from day one.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Open gym sessions</div>
                <div className="cardText">
                  Train in your own time as well as in class. Use the space, the equipment and the environment to build
                  a training routine that actually fits your week.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Full gym program through the custom app</div>
                <div className="cardText">
                  Members get a structured training plan delivered through the app, so progress continues outside the
                  classes too. It gives you direction, accountability and a proper system to follow.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Online personal training support</div>
                <div className="cardText">
                  Every member gets more than gym access. Nutrition tracking, workout tracking, movement tracking,
                  daily habits and weekly check-ins all come as part of the package. It’s a full personal training
                  setup for the price of a gym membership.
                </div>
              </div>
            </div>
          </section>

          <section id="next" className="section">
            <div className="sectionHead">
              <div className="sectionEyebrow">THE VISION</div>
              <h2 className="sectionTitle">What’s Next</h2>
              <p className="sectionSub">This is just the beginning of what Iron Acre becomes.</p>
            </div>

            <div className="grid2">
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Recovery and contrast therapy</div>
                <div className="cardText">
                  Cold water therapy is first in line, followed by wild saunas and wild hot tubs. The goal is to make
                  Iron Acre more than a place you train. It becomes a place you recover, switch off and reset too.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Expanding the training area</div>
                <div className="cardText">
                  More room, more equipment, more session capacity and more ways to train. The gym area will keep
                  evolving, and the early members will be there to shape what comes next.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">A place with real identity</div>
                <div className="cardText">
                  Iron Acre is being built to feel different from the second you arrive. Training with the meadow in
                  front of you and woodland behind you is part of the experience. It’s a gym with atmosphere, not just
                  equipment.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Be there from the start</div>
                <div className="cardText">
                  The people who join early won’t just get the best price. They’ll be the core of the community and
                  the first to experience every upgrade as Iron Acre grows.
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
                <div className="cardTitle">How does founders work?</div>
                <div className="cardText">
                  The first 20 people to accept the founders invite get £60/month locked for life. After that,
                  membership moves to £100/month.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">When do I pay?</div>
                <div className="cardText">
                  No payment is taken until one month after opening. You’re securing your place early and getting
                  invited first.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Where is it?</div>
                <div className="cardText">
                  Ipswich area. Exact location and directions will be sent by email as we get closer to launch.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Is it suitable for beginners?</div>
                <div className="cardText">
                  Yes. Sessions are coached and scaled. You start where you are and build from there properly and
                  safely.
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
                <button type="button" className="ia-btn ia-btn-primary" onClick={scrollToForm}>
                  Join the Acre
                </button>
              </div>
              <div className="contactFoot">
                Founders is limited to 20. £60/month is locked in for those spots.
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
