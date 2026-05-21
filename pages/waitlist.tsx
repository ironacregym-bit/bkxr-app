// File: pages/waitlist.tsx
import Head from "next/head";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";

type ApiResp = { ok: true; existed: boolean } | { ok: false; error: string; detail?: string };

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
    if (formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
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
        setError(err === "RATE_LIMITED" ? "Too many attempts. Try again in a few minutes." : "Could not join. Try again.");
        setLoading(false);
        return;
      }

      router.push(`/waitlist/thanks?email=${encodeURIComponent(e)}&founders=${foundersInterest ? "1" : "0"}`);
    } catch {
      setError("Could not join. Try again.");
      setLoading(false);
    }
  }

  const heroImageSrc = "/concept-1.jpg";
  const concept2Src = "/concept-2.jpg";
  const logoSrc = "/iron_acre_logo_transparent.png";

  return (
    <>
      <Head>
        <title>Iron Acre Gym | Founders</title>
        <meta name="description" content="Train hard. Be outside. Build something real. Founders £60/month locked for life (first 20)." />
        <meta property="og:title" content="Iron Acre Gym | Founders" />
        <meta property="og:description" content="Train hard. Be outside. Build something real. Founders £60/month locked for life (first 20)." />
        <meta property="og:type" content="website" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="wrap">
        <section className="hero" aria-label="Iron Acre Gym">
          <div className="heroMedia" aria-hidden="true">
            <Image src={heroImageSrc} alt="" fill priority sizes="100vw" style={{ objectFit: "cover", objectPosition: "50% 55%" }} />
          </div>

          <div className="heroOverlay" aria-hidden="true" />

          <header className="heroTop">
            <div className="brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} role="button" tabIndex={0} aria-label="Back to top">
              <span className="brandLogo" aria-hidden="true">
                <Image src={logoSrc} alt="" width={38} height={38} priority />
              </span>
              <span className="brandText">Iron Acre Gym</span>
            </div>

            <nav className="heroNav heroNavDesktop" aria-label="Page sections">
              <button type="button" className="navLink" onClick={() => scrollToId("about")}>About</button>
              <button type="button" className="navLink" onClick={() => scrollToId("classes")}>Classes</button>
              <button type="button" className="navLink" onClick={() => scrollToId("programs")}>Programs</button>
              <button type="button" className="navLink" onClick={() => scrollToId("faq")}>FAQ</button>
              <button type="button" className="navLink" onClick={() => scrollToId("contact")}>Contact</button>
            </nav>

            <button type="button" className="menuBtn heroNavMobile" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen((v) => !v)}>
              <span className="menuIcon" aria-hidden="true" />
            </button>
          </header>

          {menuOpen ? (
            <div className="mobileMenu" role="dialog" aria-modal="true" aria-label="Menu">
              <button type="button" className="mobileMenuBackdrop" onClick={() => setMenuOpen(false)} aria-label="Close menu" />
              <div className="mobileMenuPanel">
                <div className="mobileMenuTitle">Menu</div>
                <button type="button" className="mobileMenuLink" onClick={() => { setMenuOpen(false); scrollToId("about"); }}>About</button>
                <button type="button" className="mobileMenuLink" onClick={() => { setMenuOpen(false); scrollToId("classes"); }}>Classes</button>
                <button type="button" className="mobileMenuLink" onClick={() => { setMenuOpen(false); scrollToId("programs"); }}>Programs</button>
                <button type="button" className="mobileMenuLink" onClick={() => { setMenuOpen(false); scrollToId("faq"); }}>FAQ</button>
                <button type="button" className="mobileMenuLink" onClick={() => { setMenuOpen(false); scrollToId("contact"); }}>Contact</button>
                <button type="button" className="ia-btn ia-btn-primary mobileMenuCta" onClick={() => { setMenuOpen(false); scrollToForm(); }}>Join the Acre</button>
              </div>
            </div>
          ) : null}

          <div className="heroInner">
            <div className="heroLeft">
              <h1 className="headline">
                Train Hard
                <br />
                Be Outside
                <br />
                Build Something Real
              </h1>

              <div className="badgeRow">
                <div className="badge">Founders £60/month locked for life • first 20</div>
              </div>
            </div>

            <div className="heroRight" ref={formRef}>
              <div className="formCard ia-tile ia-tile-pad">
                <div className="formTitle">Join the Acre</div>
                <div className="formSub">One email. Early access. Founders gets invited first.</div>

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
                    <input type="checkbox" checked={foundersInterest} onChange={(e) => setFoundersInterest(e.target.checked)} />
                    <span>I want a founders spot (£60/month locked)</span>
                  </label>

                  {error ? <div className="formError">{error}</div> : null}

                  <button type="button" className="ia-btn ia-btn-primary formBtn" disabled={loading} onClick={submit}>
                    {loading ? "Joining…" : "Join the Acre"}
                  </button>

                  <div className="finePrint">Standard will be £100/month. No payment until one month after opening.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="heroScrollHint" aria-hidden="true" />
        </section>

        <main className="main">
          <section id="about" className="section">
            <div className="sectionHead">
              <h2 className="sectionTitle">About</h2>
              <p className="sectionSub">This is what you’ve been missing.</p>
            </div>

            <div className="grid2">
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">A training space you actually want to show up to</div>
                <div className="cardText">
                  Iron Acre is built on an old menage and aimed to open end of June. You train looking out over a meadow with sheep and horses, with a woodland backdrop behind you. Sunrise sessions that set your day up right. Sunset sessions that hit different. It’s calm, it’s raw, and it’s built for serious work.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Best in class coaching, outdoors</div>
                <div className="cardText">
                  This isn’t “random circuits in a field”. It’s structured, coached training with purpose. Every session is designed to build real strength, real fitness, and real confidence. If you want a gym that feels like an experience and performs like proper training, you’ll fit in here.
                </div>
              </div>
            </div>

            <div className="conceptWrap ia-tile" aria-hidden="true">
              <Image src={concept2Src} alt="" fill sizes="100vw" style={{ objectFit: "cover", objectPosition: "50% 55%" }} />
              <div className="conceptOverlay" aria-hidden="true" />
              <div className="conceptCaption">
                Meadow views, woodland backdrop, covered training, real kit, real sessions.
              </div>
            </div>
          </section>

          <section id="classes" className="section">
            <div className="sectionHead">
              <h2 className="sectionTitle">Classes</h2>
              <p className="sectionSub">Each session has a point. Each one makes you better.</p>
            </div>

            <div className="grid2">
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Boxing Skills and Conditioning</div>
                <div className="cardText">
                  Learn how to punch properly, move with intent, and build a gas tank that doesn’t quit. We’ll sharpen the fundamentals, then finish with conditioning that makes you feel dangerous. Bags, skill work, and the kind of training that leaves you walking out taller.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Farm Fit</div>
                <div className="cardText">
                  The outdoors is the point here. Carries, sleds, sandbags and engine work that turns “fitness” into capability. You’ll build the kind of strength that shows up in everyday life and the kind of conditioning that feels unfair to everyone else.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Kettlebell Strength</div>
                <div className="cardText">
                  Simple movements, done well, programmed to progress. You’ll build grip, legs, back, shoulders, and a body that moves as one piece. Clean technique, smart loading, and sessions that build strength without wrecking you.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Hybrid Conditioning</div>
                <div className="cardText">
                  Strength meets engine. This is where hard work gets organised. You’ll lift, move, and breathe under pressure with structure that actually improves you week to week. Not “destroy yourself” workouts. Training that builds an athlete.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">What’s next</div>
                <div className="cardText">
                  We’re building this properly and expanding it properly. Cold plunges are the first upgrade, then more kit, more session blocks, and more ways to train outside without losing quality. Early members shape what this becomes.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Why it feels different</div>
                <div className="cardText">
                  You’re not walking into a crowded room with fluorescent lighting and noise. You’re training in a purpose-built outdoor space with the view in front of you. It’s calmer. It’s sharper. It makes consistency easy because you actually want to be there.
                </div>
              </div>
            </div>
          </section>

          <section id="programs" className="section">
            <div className="sectionHead">
              <h2 className="sectionTitle">Programs</h2>
              <p className="sectionSub">This is the flagship system behind the sessions.</p>
            </div>

            <div className="grid2">
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">MVP</div>
                <div className="cardText">
                  Our flagship hybrid fitness program built around massive strength in the big lifts and conditioning that can rival professional athletes. You’ll build a powerful base, then layer the engine on top. It’s the best of strength training and sport-level conditioning, without the chaos.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">App access included for every member</div>
                <div className="cardText">
                  Every member gets full app access: nutrition tracking, workout tracking, movement tracking, daily habits and weekly check-ins. It’s a full personal training plan for the price of a gym membership, with the structure and accountability most people never get.
                </div>
              </div>
            </div>
          </section>

          <section id="faq" className="section">
            <div className="sectionHead">
              <h2 className="sectionTitle">FAQ</h2>
              <p className="sectionSub">Quick answers. No waffle.</p>
            </div>

            <div className="grid2">
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">How does founders work?</div>
                <div className="cardText">
                  The first 20 people to accept the founders invite get £60/month locked for life. After that, membership moves to £100/month.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">When do I pay?</div>
                <div className="cardText">
                  No payment is taken until one month after opening. You’re just securing your place in line and getting the invite first.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Where is it?</div>
                <div className="cardText">
                  Ipswich area. Exact location and directions are shared via email with opening updates and invites.
                </div>
              </div>

              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Is it suitable for beginners?</div>
                <div className="cardText">
                  Yes. Sessions are coached and scaled. You start where you are and build from there, safely and properly.
                </div>
              </div>
            </div>
          </section>

          <section id="contact" className="section">
            <div className="sectionHead">
              <h2 className="sectionTitle">Contact</h2>
              <p className="sectionSub">Join the Acre and we’ll keep you in the loop by email.</p>
            </div>

            <div className="contactCard ia-tile ia-tile-pad">
              <div className="contactRow">
                <div className="contactLabel">Best next step</div>
                <button type="button" className="ia-btn ia-btn-primary" onClick={scrollToForm}>Join the Acre</button>
              </div>
              <div className="contactFoot">Founders is limited to 20. £60/month is locked for those spots.</div>
            </div>
          </section>

          <footer className="footer">
            <div className="footerInner">
              <div>© {new Date().getFullYear()} Iron Acre Gym</div>
              <div className="footerLinks">
                <button type="button" className="footerLink" onClick={() => scrollToId("about")}>About</button>
                <button type="button" className="footerLink" onClick={() => scrollToId("classes")}>Classes</button>
                <button type="button" className="footerLink" onClick={() => scrollToId("contact")}>Contact</button>
              </div>
            </div>
          </footer>
        </main>

        <style jsx>{`
          .wrap{background:#06090d;color:#fff;min-height:100vh}
          .hero{position:relative;min-height:100vh;overflow:hidden}
          .heroMedia{position:absolute;inset:0}
          .heroOverlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.55) 0%,rgba(0,0,0,.20) 40%,rgba(0,0,0,.92) 100%)}
          .heroTop{position:absolute;top:0;left:0;right:0;padding:18px 18px 0 18px;display:flex;align-items:center;justify-content:space-between;gap:14px;z-index:5}
          .brand{display:inline-flex;align-items:center;gap:10px;cursor:pointer;user-select:none;min-height:44px}
          .brandLogo{width:38px;height:38px;display:inline-flex;align-items:center;justify-content:center}
          .brandText{font-weight:650;letter-spacing:.2px}
          .heroNav{display:flex;gap:14px;flex-wrap:wrap;justify-content:flex-end}
          .navLink{appearance:none;background:transparent;border:none;color:rgba(255,255,255,.78);font-weight:550;padding:10px 6px;min-height:44px;cursor:pointer}
          .navLink:hover{color:rgba(255,255,255,.95)}
          .menuBtn{appearance:none;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.14);border-radius:12px;min-height:44px;min-width:44px;padding:0;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
          .menuIcon{width:18px;height:2px;background:rgba(255,255,255,.9);border-radius:999px;position:relative;display:inline-block}
          .menuIcon:before,.menuIcon:after{content:"";position:absolute;left:0;width:18px;height:2px;background:rgba(255,255,255,.9);border-radius:999px}
          .menuIcon:before{top:-6px}
          .menuIcon:after{top:6px}
          .heroInner{position:relative;z-index:4;max-width:1100px;margin:0 auto;padding:92px 18px 36px 18px;min-height:100vh;display:grid;grid-template-columns:1.15fr .85fr;gap:18px;align-items:end}
          .headline{margin:0;font-size:54px;line-height:1.02;font-weight:650;letter-spacing:-.6px;text-shadow:0 14px 40px rgba(0,0,0,.55)}
          .badgeRow{margin-top:12px}
          .badge{display:inline-flex;align-items:center;width:fit-content;border-radius:12px;padding:10px 12px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.22);color:rgba(255,255,255,.92);font-weight:600;font-size:13px;letter-spacing:.1px}
          .formCard{border-radius:18px;background:rgba(11,15,20,.70);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(10px)}
          .formTitle{font-weight:650;font-size:18px}
          .formSub{margin-top:6px;color:rgba(255,255,255,.72);line-height:1.35;font-size:14px;font-weight:450}
          .formGrid{margin-top:12px;display:grid;gap:10px}
          .formInput{min-height:48px;background:rgba(7,10,15,.85);color:#fff;border-color:rgba(255,255,255,.12);border-radius:12px}
          .checkRow{display:flex;gap:10px;align-items:flex-start;color:rgba(255,255,255,.82);font-size:14px;font-weight:450}
          .formBtn{min-height:50px;border-radius:14px;padding:10px 16px}
          .formError{color:#ff6b6b;font-size:14px}
          .finePrint{color:rgba(255,255,255,.55);font-size:12px;line-height:1.35}
          .heroScrollHint{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);width:36px;height:6px;border-radius:999px;background:rgba(255,255,255,.22);z-index:4}
          .main{max-width:1100px;margin:0 auto;padding:18px 18px 54px 18px}
          .section{padding:22px 0}
          .sectionHead{max-width:760px}
          .sectionTitle{margin:0;font-size:22px;font-weight:600;letter-spacing:-.2px}
          .sectionSub{margin:8px 0 0 0;color:rgba(255,255,255,.72);line-height:1.45;font-weight:450}
          .grid3{margin-top:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
          .grid2{margin-top:14px;display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
          .card{border-radius:18px;background:#0b0f14;border:1px solid rgba(255,255,255,.06)}
          .cardTitle{font-weight:600;font-size:16px}
          .cardText{margin-top:8px;color:rgba(255,255,255,.72);line-height:1.5;font-weight:450}
          .conceptWrap{margin-top:14px;border-radius:18px;overflow:hidden;border:1px solid rgba(255,255,255,.06);background:#070a0f;position:relative;height:360px}
          .conceptOverlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.10),rgba(0,0,0,.78))}
          .conceptCaption{position:absolute;left:14px;right:14px;bottom:12px;color:rgba(255,255,255,.90);font-weight:600;text-shadow:0 10px 26px rgba(0,0,0,.55)}
          .contactCard{border-radius:18px;background:#0b0f14;border:1px solid rgba(255,255,255,.06)}
          .contactRow{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center}
          .contactLabel{font-weight:600}
          .contactFoot{margin-top:10px;color:rgba(255,255,255,.70);line-height:1.45;font-weight:450}
          .footer{padding-top:24px;border-top:1px solid rgba(255,255,255,.06);margin-top:12px}
          .footerInner{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;color:rgba(255,255,255,.55);font-size:12px}
          .footerLinks{display:flex;gap:12px;flex-wrap:wrap}
          .footerLink{appearance:none;background:transparent;border:none;padding:0;color:rgba(255,255,255,.60);cursor:pointer;text-decoration:underline;text-underline-offset:3px;font-weight:550}
          .footerLink:hover{color:rgba(255,255,255,.85)}
          .heroNavMobile{display:none}
          .mobileMenu{position:fixed;inset:0;z-index:9999}
          .mobileMenuBackdrop{position:absolute;inset:0;background:rgba(0,0,0,.55);border:none}
          .mobileMenuPanel{position:absolute;right:12px;top:12px;left:12px;border-radius:16px;background:rgba(11,15,20,.92);border:1px solid rgba(255,255,255,.10);padding:14px;backdrop-filter:blur(10px)}
          .mobileMenuTitle{font-weight:650;margin-bottom:10px}
          .mobileMenuLink{width:100%;text-align:left;appearance:none;background:transparent;border:1px solid rgba(255,255,255,.10);color:rgba(255,255,255,.90);border-radius:12px;padding:12px;min-height:46px;margin-top:8px;font-weight:550;cursor:pointer}
          .mobileMenuCta{width:100%;margin-top:10px;border-radius:12px;min-height:48px}
          @media (max-width:980px){.heroInner{grid-template-columns:1fr;align-items:end;padding-top:84px}.headline{font-size:44px}}
          @media (max-width:720px){.heroNavDesktop{display:none}.heroNavMobile{display:inline-flex}.grid3{grid-template-columns:1fr}.grid2{grid-template-columns:1fr}.headline{font-size:40px}.conceptWrap{height:300px}}
        `}</style>
      </div>
    </>
  );
}
