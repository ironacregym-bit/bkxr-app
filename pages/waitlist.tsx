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

const CLASS_OPTIONS: Array<{ key: string; label: string; desc: string }> = [
  { key: "Boxing Skills & Conditioning", label: "Boxing Skills & Conditioning", desc: "Technique first, then fitness finishers on the bags." },
  { key: "Farm Fit", label: "Farm Fit", desc: "Outdoor strength and conditioning using carries, sleds, sandbags, and bodyweight." },
  { key: "Kettlebell Strength", label: "Kettlebell Strength", desc: "Strong basics, simple progressions, real results." },
  { key: "Hybrid Conditioning", label: "Hybrid Conditioning", desc: "Strength plus engine work, paced so you improve every week." },
  { key: "Military Fit", label: "Military Fit", desc: "Team-style intervals and grit, structured and scalable." },
];

export default function WaitlistPage() {
  const router = useRouter();
  const formRef = useRef<HTMLDivElement | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [goal, setGoal] = useState("Strength");
  const [consent, setConsent] = useState(true);
  const [foundersInterest, setFoundersInterest] = useState(true);
  const [interests, setInterests] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const utm = useMemo(() => {
    const q = router.query || {};
    return {
      utm_source: getStr(q.utm_source),
      utm_medium: getStr(q.utm_medium),
      utm_campaign: getStr(q.utm_campaign),
      utm_content: getStr(q.utm_content),
      utm_term: getStr(q.utm_term),
    };
  }, [router.query]);

  useEffect(() => {
    if (!router.isReady) return;
    const maybeEmail = getStr(router.query.email);
    if (maybeEmail && !email) setEmail(maybeEmail);
  }, [router.isReady, router.query, email]);

  function scrollToForm() {
    if (formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleInterest(key: string) {
    setInterests((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
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
          name: name.trim(),
          email: e,
          phone: phone.trim(),
          goal,
          consent,
          founders_interest: foundersInterest,
          interests,
          utm,
          referrer: typeof document !== "undefined" ? document.referrer : "",
        }),
      });

      const data = (await resp.json().catch(() => null)) as ApiResp | null;

      if (!resp.ok || !data || (data as any).ok !== true) {
        const err = (data as any)?.error || "Something went wrong.";
        setError(err === "RATE_LIMITED" ? "Too many attempts. Try again in a few minutes." : "Could not join the waitlist. Try again.");
        setLoading(false);
        return;
      }

      router.push(`/waitlist/thanks?email=${encodeURIComponent(e)}`);
    } catch {
      setError("Could not join the waitlist. Try again.");
      setLoading(false);
    }
  }

  const heroImageSrc = "/concept-1.jpg";
  const concept2Src = "/concept-2.jpg";

  return (
    <>
      <Head>
        <title>Iron Acre Gym Outdoor Gym Waitlist</title>
        <meta name="description" content="Covered outdoor container gym overlooking a meadow. Founders £60/month locked for life (first 20)." />
        <meta property="og:title" content="Iron Acre Gym Outdoor Gym Waitlist" />
        <meta property="og:description" content="Train outdoors on an old menage overlooking a meadow. Founders £60/month locked for life (first 20)." />
        <meta property="og:type" content="website" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ minHeight: "100vh", background: "#070a0f" }}>
        <div className="container" style={{ paddingTop: 18, paddingBottom: 54, maxWidth: 1080 }}>
          <div className="d-flex align-items-center justify-content-between" style={{ marginBottom: 12 }}>
            <div style={{ color: "#fff", fontWeight: 900, letterSpacing: 0.2, fontSize: 18 }}>Iron Acre Gym</div>
            <div className="text-dim small" style={{ color: "rgba(255,255,255,0.72)" }}>Outdoor Gym • Ipswich</div>
          </div>

          <div className="ia-tile" style={{ borderRadius: 18, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", background: "#0b0f14" }}>
            <div className="row g-0">
              <div className="col-12 col-lg-7">
                <div className="waitlist-hero">
                  <div className="waitlist-hero-media">
                    <Image
                      src={heroImageSrc}
                      alt="Iron Acre Gym concept"
                      fill
                      priority
                      sizes="(max-width: 991px) 100vw, 60vw"
                      style={{ objectFit: "cover", objectPosition: "50% 60%" }}
                    />
                  </div>

                  <div className="waitlist-hero-overlay" />

                  <div className="waitlist-hero-content">
                    <div className="waitlist-badge">Founders £60/month locked for life • first 20</div>

                    <div className="waitlist-hero-title">
                      Train outdoors.
                      <br />
                      Get strong.
                      <br />
                      Feel unreal.
                    </div>

                    <div className="waitlist-hero-sub">
                      Covered outdoor container gym on an old menage overlooking a meadow with sheep and cows.
                      <span style={{ color: "#fff" }}> Strength, conditioning, kettlebells and bags.</span>
                    </div>

                    <div className="waitlist-hero-actions">
                      <button
                        type="button"
                        className="ia-btn ia-btn-primary"
                        style={{ borderRadius: 14, minHeight: 48, padding: "10px 16px", minWidth: 220 }}
                        onClick={scrollToForm}
                      >
                        Join the waitlist
                      </button>

                      <button
                        type="button"
                        className="waitlist-link-btn"
                        onClick={() => document.getElementById("concept")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      >
                        See concept
                      </button>
                    </div>

                    <div className="waitlist-hero-fineprint">
                      No payment taken until one month after opening. Waitlist is free — it keeps you in the loop and gives first refusal on founders.
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-5" ref={formRef}>
                <div style={{ padding: 18 }}>
                  <div className="ia-tile ia-tile-pad" style={{ borderRadius: 18, background: "#0b0f14", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ color: "#fff", fontWeight: 950, fontSize: 18 }}>Join the waitlist</div>
                    <div style={{ color: "rgba(255,255,255,0.72)", marginTop: 6, lineHeight: 1.35 }}>Get opening updates and founders invites first.</div>

                    <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                      <input
                        className="form-control"
                        style={{ minHeight: 46, background: "#070a0f", color: "#fff", borderColor: "rgba(255,255,255,0.12)" }}
                        placeholder="Name (optional)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                      <input
                        className="form-control"
                        style={{ minHeight: 46, background: "#070a0f", color: "#fff", borderColor: "rgba(255,255,255,0.12)" }}
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        inputMode="email"
                        autoCapitalize="none"
                      />
                      <input
                        className="form-control"
                        style={{ minHeight: 46, background: "#070a0f", color: "#fff", borderColor: "rgba(255,255,255,0.12)" }}
                        placeholder="Phone (optional)"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        inputMode="tel"
                      />

                      <select
                        className="form-select"
                        style={{ minHeight: 46, background: "#070a0f", color: "#fff", borderColor: "rgba(255,255,255,0.12)" }}
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                      >
                        <option value="Strength">Primary goal: Strength</option>
                        <option value="Fat loss">Primary goal: Fat loss</option>
                        <option value="Conditioning">Primary goal: Conditioning</option>
                        <option value="Boxing">Primary goal: Boxing</option>
                        <option value="General fitness">Primary goal: General fitness</option>
                      </select>

                      <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 12, background: "rgba(255,255,255,0.02)" }}>
                        <div style={{ color: "#fff", fontWeight: 900, marginBottom: 8 }}>Classes you’re into</div>
                        <div className="d-flex flex-wrap" style={{ gap: 8 }}>
                          {CLASS_OPTIONS.map((c) => {
                            const on = interests.includes(c.key);
                            return (
                              <button
                                key={c.key}
                                type="button"
                                className={on ? "ia-btn ia-btn-primary" : "ia-btn ia-btn-outline"}
                                style={{ borderRadius: 999, minHeight: 40, padding: "8px 12px" }}
                                onClick={() => toggleInterest(c.key)}
                              >
                                {c.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "rgba(255,255,255,0.80)", fontSize: 14 }}>
                        <input type="checkbox" checked={foundersInterest} onChange={(e) => setFoundersInterest(e.target.checked)} style={{ marginTop: 3 }} />
                        I want a founders spot (£60/month locked for life, first 20)
                      </label>

                      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "rgba(255,255,255,0.70)", fontSize: 14 }}>
                        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
                        I agree to receive updates about opening dates, sessions, and founders invites.
                      </label>

                      {error ? <div style={{ color: "#ff6b6b", fontSize: 14 }}>{error}</div> : null}

                      <button
                        type="button"
                        className="ia-btn ia-btn-primary"
                        style={{ borderRadius: 14, minHeight: 48, padding: "10px 16px" }}
                        disabled={loading}
                        onClick={submit}
                      >
                        {loading ? "Joining…" : "Join the waitlist"}
                      </button>

                      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
                        Founders is limited. Standard price will be £100/month. First payment is taken one month after opening.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ height: 14 }} />

          <div className="row g-3">
            <div className="col-12 col-lg-6">
              <div className="ia-tile ia-tile-pad" style={{ borderRadius: 18, background: "#0b0f14", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "#fff", fontWeight: 950, fontSize: 18 }}>Pricing</div>
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.82)" }}>
                    <span style={{ color: "#fff", fontWeight: 950 }}>Founders</span>
                    <span style={{ color: "#fff", fontWeight: 950 }}>£60/month</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.72)" }}>
                    <span>Locked for life</span>
                    <span>First 20 people</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.72)" }}>
                    <span>Standard price</span>
                    <span style={{ color: "#fff", fontWeight: 900 }}>£100/month</span>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>No payment taken until one month after we open.</div>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-6">
              <div className="ia-tile ia-tile-pad" style={{ borderRadius: 18, background: "#0b0f14", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ color: "#fff", fontWeight: 950, fontSize: 18 }}>What you’ll train</div>
                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                  {CLASS_OPTIONS.map((c) => (
                    <div key={c.key} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                      <div style={{ color: "#fff", fontWeight: 900 }}>{c.label}</div>
                      <div style={{ color: "rgba(255,255,255,0.70)", fontSize: 14, marginTop: 4, lineHeight: 1.35 }}>{c.desc}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
                  Short-term: cold plunges. Long-term: we keep expanding the space and the sessions.
                </div>
              </div>
            </div>
          </div>

          <div style={{ height: 14 }} />

          <div id="concept" className="ia-tile ia-tile-pad" style={{ borderRadius: 18, background: "#0b0f14", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ color: "#fff", fontWeight: 950, fontSize: 18 }}>Concept</div>
            </div>

            <div className="row g-3" style={{ marginTop: 6 }}>
              <div className="col-12">
                <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", background: "#070a0f" }}>
                  <div style={{ position: "relative", width: "100%", aspectRatio: "16/9" as any }}>
                    <Image src={concept2Src} alt="Iron Acre Gym concept view" fill sizes="100vw" style={{ objectFit: "cover" }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, color: "rgba(255,255,255,0.72)", lineHeight: 1.45 }}>
              Built on an old menage overlooking a meadow. Covered canopy training floor with storage and kit built into the containers.
            </div>

            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button type="button" className="ia-btn ia-btn-primary" style={{ borderRadius: 14, minHeight: 46, padding: "10px 14px" }} onClick={scrollToForm}>
                Join the waitlist
              </button>
              <div style={{ color: "rgba(255,255,255,0.60)", fontSize: 13, alignSelf: "center" }}>Founders is limited to 20.</div>
            </div>
          </div>

          <div style={{ height: 14 }} />

          <div className="ia-tile ia-tile-pad" style={{ borderRadius: 18, background: "#0b0f14", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ color: "#fff", fontWeight: 950, fontSize: 18 }}>FAQ</div>

            <div className="row g-3" style={{ marginTop: 6 }}>
              <div className="col-12 col-md-6">
                <div className="ia-tile" style={{ borderRadius: 16, padding: 14, background: "#070a0f", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color: "#fff", fontWeight: 900 }}>Where is it?</div>
                  <div style={{ color: "rgba(255,255,255,0.72)", marginTop: 6 }}>
                    Ipswich area, set on an old menage overlooking a meadow with sheep and cows.
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="ia-tile" style={{ borderRadius: 16, padding: 14, background: "#070a0f", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color: "#fff", fontWeight: 900 }}>When does it open?</div>
                  <div style={{ color: "rgba(255,255,255,0.72)", marginTop: 6 }}>Opening dates go to the waitlist first.</div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="ia-tile" style={{ borderRadius: 16, padding: 14, background: "#070a0f", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color: "#fff", fontWeight: 900 }}>How does founders work?</div>
                  <div style={{ color: "rgba(255,255,255,0.72)", marginTop: 6 }}>
                    First 20 people to accept the invite get £60/month locked for life. After that it’s £100/month.
                  </div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="ia-tile" style={{ borderRadius: 16, padding: 14, background: "#070a0f", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color: "#fff", fontWeight: 900 }}>When is the first payment taken?</div>
                  <div style={{ color: "rgba(255,255,255,0.72)", marginTop: 6 }}>One month after opening.</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button type="button" className="ia-btn ia-btn-primary" style={{ borderRadius: 14, minHeight: 46, padding: "10px 14px" }} onClick={scrollToForm}>
                Join the waitlist
              </button>
              <div style={{ color: "rgba(255,255,255,0.60)", fontSize: 13, alignSelf: "center" }}>Founders is limited to 20.</div>
            </div>
          </div>

          <div style={{ marginTop: 18, color: "rgba(255,255,255,0.5)", fontSize: 12, textAlign: "center" }}>
            © {new Date().getFullYear()} Iron Acre Gym
          </div>
        </div>

        <style jsx>{`
          .waitlist-hero {
            position: relative;
            width: 100%;
            height: 560px;
            background: #05070b;
          }
          .waitlist-hero-media {
            position: absolute;
            inset: 0;
          }
          .waitlist-hero-overlay {
            position: absolute;
            inset: 0;
            background: linear-gradient(180deg, rgba(0, 0, 0, 0.42) 0%, rgba(0, 0, 0, 0.12) 42%, rgba(0, 0, 0, 0.82) 100%);
          }
          .waitlist-hero-content {
            position: absolute;
            inset: 0;
            padding: 18px;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            gap: 10px;
          }
          .waitlist-badge {
            display: inline-flex;
            align-items: center;
            width: fit-content;
            border-radius: 12px;
            padding: 10px 12px;
            border: 1px solid rgba(255, 255, 255, 0.14);
            background: rgba(0, 0, 0, 0.22);
            color: rgba(255, 255, 255, 0.92);
            font-weight: 900;
            font-size: 13px;
            letter-spacing: 0.1px;
          }
          .waitlist-hero-title {
            color: #fff;
            font-size: 44px;
            line-height: 1.02;
            font-weight: 950;
            letter-spacing: -0.3px;
            text-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
          }
          .waitlist-hero-sub {
            color: rgba(255, 255, 255, 0.82);
            font-size: 16px;
            line-height: 1.45;
            max-width: 640px;
          }
          .waitlist-hero-actions {
            display: flex;
            gap: 12px;
            align-items: center;
            flex-wrap: wrap;
            margin-top: 4px;
          }
          .waitlist-link-btn {
            background: transparent;
            border: none;
            padding: 10px 6px;
            min-height: 44px;
            color: rgba(255, 255, 255, 0.78);
            font-weight: 800;
            letter-spacing: 0.1px;
            text-decoration: underline;
            text-underline-offset: 4px;
            cursor: pointer;
          }
          .waitlist-link-btn:hover {
            color: rgba(255, 255, 255, 0.92);
          }
          .waitlist-hero-fineprint {
            color: rgba(255, 255, 255, 0.62);
            font-size: 12px;
            line-height: 1.35;
            max-width: 680px;
            margin-top: 2px;
          }
          @media (max-width: 991px) {
            .waitlist-hero {
              height: 680px;
            }
            .waitlist-hero-title {
              font-size: 42px;
            }
          }
          @media (max-width: 480px) {
            .waitlist-hero {
              height: 740px;
            }
            .waitlist-hero-title {
              font-size: 40px;
            }
          }
        `}</style>
      </div>
    </>
  );
}
