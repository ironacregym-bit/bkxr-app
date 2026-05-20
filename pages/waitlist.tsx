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
  const [consent, setConsent] = useState(true);

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
          consent,
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

      router.push(`/waitlist/thanks?email=${encodeURIComponent(e)}`);
    } catch {
      setError("Could not join. Try again.");
      setLoading(false);
    }
  }

  const heroImageSrc = "/concept-1.jpg";
  const concept2Src = "/concept-2.jpg";

  return (
    <>
      <Head>
        <title>Iron Acre Gym | Founders Waitlist</title>
        <meta name="description" content="Founders £60/month locked for life (first 20). Standard £100/month." />
        <meta property="og:title" content="Iron Acre Gym | Founders Waitlist" />
        <meta property="og:description" content="Train outdoors. Founders £60/month locked for life (first 20)." />
        <meta property="og:type" content="website" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="wrap">
        <section className="hero" aria-label="Iron Acre Gym Waitlist Hero">
          <div className="heroMedia" aria-hidden="true">
            <Image src={heroImageSrc} alt="" fill priority sizes="100vw" style={{ objectFit: "cover", objectPosition: "50% 55%" }} />
          </div>

          <div className="heroOverlay" aria-hidden="true" />

          <header className="heroTop">
            <div className="brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} role="button" tabIndex={0} aria-label="Back to top">
              <span className="brandMark" aria-hidden="true" />
              <span className="brandText">Iron Acre Gym</span>
            </div>

            <nav className="heroNav heroNavDesktop" aria-label="Page sections">
              <button type="button" onClick={() => scrollToId("programs")} className="navLink">Programs</button>
              <button type="button" onClick={() => scrollToId("classes")} className="navLink">Classes</button>
              <button type="button" onClick={() => scrollToId("faq")} className="navLink">FAQ</button>
              <button type="button" onClick={() => scrollToId("contact")} className="navLink">Contact</button>
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
                <button type="button" className="mobileMenuLink" onClick={() => { setMenuOpen(false); scrollToId("programs"); }}>Programs</button>
                <button type="button" className="mobileMenuLink" onClick={() => { setMenuOpen(false); scrollToId("classes"); }}>Classes</button>
                <button type="button" className="mobileMenuLink" onClick={() => { setMenuOpen(false); scrollToId("faq"); }}>FAQ</button>
                <button type="button" className="mobileMenuLink" onClick={() => { setMenuOpen(false); scrollToId("contact"); }}>Contact</button>
                <button type="button" className="ia-btn ia-btn-primary mobileMenuCta" onClick={() => { setMenuOpen(false); scrollToForm(); }}>
                  Join waitlist
                </button>
              </div>
            </div>
          ) : null}

          <div className="heroInner">
            <div className="heroLeft">
              <h1 className="headline">
                Train outdoors.
                <br />
                Founders spots are limited.
              </h1>

              <div className="badgeRow">
                <div className="badge">Founders £60/month locked for life • first 20</div>
              </div>
            </div>

            <div className="heroRight" ref={formRef}>
              <div className="formCard ia-tile ia-tile-pad">
                <div className="formTitle">Get the invite first</div>
                <div className="formSub">Email only. Tick founders if you want one of the 20.</div>

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
                    <span>I want a founders spot (£60/month locked for life)</span>
                  </label>

                  <label className="checkRow dim">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    <span>I agree to receive opening updates and founders invites</span>
                  </label>

                  {error ? <div className="formError">{error}</div> : null}

                  <button type="button" className="ia-btn ia-btn-primary formBtn" disabled={loading} onClick={submit}>
                    {loading ? "Joining…" : "Join waitlist"}
                  </button>

                  <div className="finePrint">No payment taken until one month after opening. Unsubscribe anytime.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="heroScrollHint" aria-hidden="true" />
        </section>

        <main className="main">
          <section id="programs" className="section">
            <div className="sectionHead">
              <h2 className="sectionTitle">Programs</h2>
              <p className="sectionSub">Simple, coached training built to progress.</p>
            </div>

            <div className="grid3">
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Small group coaching</div>
                <div className="cardText">Max 12 people. You get coached properly, not lost in a crowd.</div>
              </div>
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Strength and conditioning</div>
                <div className="cardText">Sessions built around getting stronger and fitter week to week.</div>
              </div>
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Outdoor setting</div>
                <div className="cardText">A calm, open training space that feels different to a commercial gym.</div>
              </div>
            </div>
          </section>

          <section id="classes" className="section">
            <div className="sectionHead">
              <h2 className="sectionTitle">Classes</h2>
              <p className="sectionSub">Boxing, farm fitness, kettlebells, hybrid, military fit.</p>
            </div>

            <div className="grid2">
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Boxing Skills and Conditioning</div>
                <div className="cardText">Technique first, then fitness finishers on the bags.</div>
              </div>
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Farm Fit</div>
                <div className="cardText">Carries, sleds and sandbags. Outdoor engine work.</div>
              </div>
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Kettlebell Strength</div>
                <div className="cardText">Strong basics, simple progressions, real results.</div>
              </div>
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">Hybrid Conditioning</div>
                <div className="cardText">Strength plus engine work, paced so you improve.</div>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="sectionHead">
              <h2 className="sectionTitle">Concept</h2>
              <p className="sectionSub">A preview of the space.</p>
            </div>

            <div className="conceptWrap ia-tile">
              <div className="conceptMedia" aria-hidden="true">
                <Image src={concept2Src} alt="" fill sizes="100vw" style={{ objectFit: "cover", objectPosition: "50% 55%" }}       </div>
          </section>

          <section id="faq" className="section">
            <div className="sectionHead">
              <h2 className="sectionTitle">FAQ</h2>
              <p className="sectionSub">Quick answers.</p>
            </div>

            <div className="grid2">
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">How does founders work?</div>
                <div className="cardText">First 20 people to accept the invite get £60/month locked for life. After that it’s £100/month.</div>
              </div>
              <div className="card ia-tile ia-tile-pad">
                <div className="cardTitle">When do I pay?</div>
                <div className="cardText">First payment is taken one month after opening. The waitlist is free until then.</div>
              </div>
            </div>
          </section>

          <section id="contact" className="section">
            <div className="sectionHead">
              <h2 className="sectionTitle">Contact</h2>
              <p className="sectionSub">Join the waitlist and you’ll get updates by email.</p>
            </div>

            <div className="contactCard ia-tile ia-tile-pad">
              <div className="contactRow">
                <div className="contactLabel">Best next step</div>
                <button type="button" className="ia-btn ia-btn-primary" onClick={scrollToForm}>
                  Join waitlist
                </button>
              </div>
              <div className="contactFoot">Founders is limited to 20. £60/month is locked for life for those spots.</div>
            </div>
          </section>

          <footer className="footer">
            <div className="footerInner">
              <div>© {new Date().getFullYear()} Iron Acre Gym</div>
              <div className="footerLinks">
                <button type="button" className="footerLink" onClick={() => scrollToId("programs")}>Programs</button>
                <button type="button" className="footerLink" onClick={() => scrollToId("faq")}>FAQ</button>
                <button type="button" className="footerLink" onClick={() => scrollToId("contact")}>Contact</button>
              </div>
            </div>
          </footer>
        </main>

        <style jsx>{`
          .wrap { background:#06090d; color:#fff; min-height:100vh; }
          .hero { position:relative; min-height:100vh; overflow:hidden; }
          .heroMedia { position:absolute; inset:0; }
          .heroOverlay { position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,.52) 0%,rgba(0,0,0,.18) 40%,rgba(0,0,0,.92) 100%); }
          .heroTop { position:absolute; top:0; left:0; right:0; padding:18px 18px 0 18px; display:flex; align-items:center; justify-content:space-between; gap:14px; z-index:5; }
          .brand { display:inline-flex; align-items:center; gap:10px; cursor:pointer; user-select:none; min-height:44px; }
          .brandMark { width:34px; height:34px; border-radius:10px; background:linear-gradient(135deg,rgba(0,255,170,.95),rgba(0,180,255,.85)); box-shadow:0 12px 28px rgba(0,255,170,.18); }
          .brandText { font-weight:750; letter-spacing:.2px; }
          .heroNav { display:flex; gap:14px; flex-wrap:wrap; justify-content:flex-end; }
          .navLink { appearance:none; background:transparent; border:none; color:rgba(255,255,255,.78); font-weight:650; padding:10px 6px; min-height:44px; cursor:pointer; }
          .navLink:hover { color:rgba(255,255,255,.95); }
          .menuBtn { appearance:none; background:rgba(0,0,0,.18); border:1px solid rgba(255,255,255,.14); border-radius:12px; min-height:44px; min-width:44px; padding:0; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }
          .menuIcon { width:18px; height:2px; background:rgba(255,255,255,.9); border-radius:999px; position:relative; display:inline-block; }
          .menuIcon:before, .menuIcon:after { content:""; position:absolute; left:0; width:18px; height:2px; background:rgba(255,255,255,.9); border-radius:999px; }
          .menuIcon:before { top:-6px; }
          .menuIcon:after { top:6px; }

          .heroInner { position:relative; z-index:4; max-width:1100px; margin:0 auto; padding:92px 18px 36px 18px; min-height:100vh; display:grid; grid-template-columns: 1.15fr 0.85fr; gap:18px; align-items:end; }
          .headline { margin:0; font-size:54px; line-height:1.02; font-weight:700; letter-spacing:-.6px; text-shadow:0 14px 40px rgba(0,0,0,.55); }
          .badgeRow { margin-top:12px; }
          .badge { display:inline-flex; align-items:center; width:fit-content; border-radius:12px; padding:10px 12px; border:1px solid rgba(255,255,255,.14); background:rgba(0,0,0,.22); color:rgba(255,255,255,.92); font-weight:700; font-size:13px; letter-spacing:.1px; }

          .formCard { border-radius:18px; background:rgba(11,15,20,.70); border:1px solid rgba(255,255,255,.08); backdrop-filter: blur(10px); }
          .formTitle { font-weight:700; font-size:18px; }
          .formSub { margin-top:6px; color:rgba(255,255,255,.72); line-height:1.35; font-size:14px; font-weight:500; }
          .formGrid { margin-top:14px; display:grid; gap:10px; }
          .formInput { min-height:48px; background:rgba(7,10,15,.85); color:#fff; border-color:rgba(255,255,255,.12); border-radius:12px; }
          .checkRow { display:flex; gap:10px; align-items:flex-start; color:rgba(255,255,255,.82); font-size:14px; font-weight:500; }
          .checkRow.dim { color:rgba(255,255,255,.70); }
          .formBtn { min-height:50px; border-radius:14px; padding:10px 16px; }
          .formError { color:#ff6b6b; font-size:14px; }
          .finePrint { color:rgba(255,255,255,.55); font-size:12px; line-height:1.35; }

          .heroScrollHint { position:absolute; left:50%; bottom:14px; transform:translateX(-50%); width:36px; height:6px; border-radius:999px; background:rgba(255,255,255,.22); z-index:4; }

          .main { max-width:1100px; margin:0 auto; padding:18px 18px 54px 18px; }
          .section { padding:22px 0; }
          .sectionHead { max-width:760px; }
          .sectionTitle { margin:0; font-size:22px; font-weight:650; letter-spacing:-.2px; }
          .sectionSub { margin:8px 0 0 0; color:rgba(255,255,255,.72); line-height:1.45; font-weight:500; }
          .grid3 { margin-top:14px; display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
          .grid2 { margin-top:14px; display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
          .card { border-radius:18px; background:#0b0f14; border:1px solid rgba(255,255,255,.06); }
          .cardTitle { font-weight:650; font-size:16px; }
          .cardText { margin-top:8px; color:rgba(255,255,255,.72); line-height:1.45; font-weight:500; }

          .conceptWrap { margin-top:14px; border-radius:18px; overflow:hidden; border:1px solid rgba(255,255,255,.06); background:#070a0f; position:relative; height:360px; }
          .conceptMedia { position:absolute; inset:0; }
          .conceptOverlay { position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,.10),rgba(0,0,0,.70)); }

          .contactCard { border-radius:18px; background:#0b0f14; border:1px solid rgba(255,255,255,.06); }
          .contactRow { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; align-items:center; }
          .contactLabel { font-weight:650; }
          .contactFoot { margin-top:10px; color:rgba(255,255,255,.70); line-height:1.45; font-weight:500; }

          .footer { padding-top:24px; border-top:1px solid rgba(255,255,255,.06); margin-top:12px; }
          .footerInner { display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap; color:rgba(255,255,255,.55); font-size:12px; }
          .footerLinks { display:flex; gap:12px; flex-wrap:wrap; }
          .footerLink { appearance:none; background:transparent; border:none; padding:0; color:rgba(255,255,255,.60); cursor:pointer; text-decoration:underline; text-underline-offset:3px; font-weight:600; }
          .footerLink:hover { color:rgba(255,255,255,.85); }

          .heroNavMobile { display:none; }
          .mobileMenu { position:fixed; inset:0; z-index:9999; }
          .mobileMenuBackdrop { position:absolute; inset:0; background:rgba(0,0,0,.55); border:none; }
          .mobileMenuPanel { position:absolute; right:12px; top:12px; left:12px; border-radius:16px; background:rgba(11,15,20,.92); border:1px solid rgba(255,255,255,.10); padding:14px; backdrop-filter: blur(10px); }
          .mobileMenuTitle { font-weight:700; margin-bottom:10px; }
          .mobileMenuLink { width:100%; text-align:left; appearance:none; background:transparent; border:1px solid rgba(255,255,255,.10); color:rgba(255,255,255,.90); border-radius:12px; padding:12px; min-height:46px; margin-top:8px; font-weight:650; cursor:pointer; }
          .mobileMenuCta { width:100%; margin-top:10px; border-radius:12px; min-height:48px; }

          @media (max-width: 980px) {
            .heroInner { grid-template-columns: 1fr; align-items:end; padding-top:84px; }
            .headline { font-size:44px; }
          }
          @media (max-width: 720px) {
            .heroNavDesktop { display:none; }
            .heroNavMobile { display:inline-flex; }
            .grid3 { grid-template-columns: 1fr; }
            .grid2 { grid-template-columns: 1fr; }
            .headline { font-size:40px; }
          }
        `}</style>
      </div>
    </>
  );
}
