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

const CLASSES: Array<{ key: string; name: string; desc: string }> = [
  { key: "Boxing Skills & Conditioning", name: "Boxing Skills & Conditioning", desc: "Technique first, then fitness finishers on the bags." },
  { key: "Farm Fit", name: "Farm Fit", desc: "Outdoor strength and conditioning using carries, sleds, sandbags, and bodyweight." },
  { key: "Kettlebell Strength", name: "Kettlebell Strength", desc: "Simple programming, strong fundamentals, serious results." },
  { key: "Hybrid Conditioning", name: "Hybrid Conditioning", desc: "Strength plus engine work, paced properly so you improve every week." },
  { key: "Military Fit", name: "Military Fit", desc: "Team-style intervals and grit, structured and scalable for all levels." },
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
  const [videoCanPlay, setVideoCanPlay] = useState(true);

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

  function toggleInterest(label: string) {
    setInterests((prev) => {
      if (prev.includes(label)) return prev.filter((x) => x !== label);
      return [...prev, label];
    });
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

  function scrollToForm() {
    if (formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const heroVideoSrc = "/waitlist/meadow.mp4";
  const concept1Src = "/waitlist/concept-1.jpg";
  const concept2Src = "/waitlist/concept-2.jpg";

  return (
    <>
      <Head>
        <title>Iron Acre Gym Outdoor Gym Waitlist</title>
        <meta name="description" content="Join the Iron Acre Gym outdoor gym waitlist. Founders membership £60/month locked for life for the first 20." />
        <meta property="og:title" content="Iron Acre Gym Outdoor Gym Waitlist" />
        <meta property="og:description" content="Covered outdoor container gym on an old menage overlooking a meadow. Join the waitlist for founders pricing." />
        <meta property="og:type" content="website" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ minHeight: "100vh", background: "#070a0f" }}>
        <div className="container" style={{ paddingTop: 18, paddingBottom: 46, maxWidth: 1080 }}>
          <div className="d-flex align-items-center justify-content-between" style={{ marginBottom: 12 }}>
            <div style={{ color: "#fff", fontWeight: 900, letterSpacing: 0.2, fontSize: 18 }}>Iron Acre Gym</div>
            <div className="text-dim small" style={{ color: "rgba(255,255,255,0.72)" }}>
              Outdoor Gym • Ipswich
            </div>
          </div>

          <div
            className="ia-tile"
            style={{
              borderRadius: 18,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.06)",
              background: "#0b0f14",
            }}
          >
            <div className="row g-0">
              <div className="col-12 col-lg-7">
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: 520,
                    background: "#05070b",
                  }}
                >
                  {videoCanPlay ? (
                    <video
                      src={heroVideoSrc}
                      muted
                      playsInline
                      autoPlay
                      loop
                      preload="metadata"
                      onError={() => setVideoCanPlay(false)}
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: "50% 60%",
                        filter: "saturate(1.05) contrast(1.05)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background:
                          "radial-gradient(900px 420px at 20% 15%, rgba(0,255,170,0.18), transparent 55%), radial-gradient(900px 420px at 75% 0%, rgba(110,168,255,0.18), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "rgba(255,255,255,0.75)",
                        padding: 18,
                        textAlign: "center",
                      }}
                    >
                      Add your portrait video at <span style={{ color: "#fff", fontWeight: 900, margin: "0 6px" }}>/public/waitlist/meadow.mp4</span>
                    </div>
                  )}

                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background:
                        "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.70) 100%)",
                    }}
                  />

                  <div style={{ position: "absolute", inset: 0, padding: 18, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          borderRadius: 999,
                          padding: "8px 12px",
                          border: "1px solid rgba(255,255,255,0.14)",
                          background: "rgba(0,0,0,0.25)",
                          color: "rgba(255,255,255,0.92)",
                          fontWeight: 800,
                          fontSize: 13,
                        }}
                      >
                        Founders £60/month locked for life • first 20
                      </span>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          borderRadius: 999,
                          padding: "8px 12px",
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(0,0,0,0.22)",
                          color: "rgba(255,255,255,0.85)",
                          fontSize: 13,
                        }}
                      >
                        Old menage • meadow views • sheep & cows
                      </span>
                    </div>

                    <div style={{ color: "#fff", fontSize: 40, lineHeight: 1.02, fontWeight: 950, letterSpacing: -0.3 }}>
                      Train outdoors.
                      <br />
                      Get strong.
                      <br />
                      Feel unreal.
                    </div>

                    <div style={{ color: "rgba(255,255,255,0.82)", marginTop: 10, fontSize: 16, lineHeight: 1.45, maxWidth: 620 }}>
                      A covered outdoor container gym overlooking a meadow. Small group coached sessions built around strength, conditioning, kettlebells and bags.
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                      <div style={{ borderRadius: 999, padding: "8px 12px", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.88)", background: "rgba(0,0,0,0.20)" }}>
                        Max 12 per session
                      </div>
                      <div style={{ borderRadius: 999, padding: "8px 12px", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.88)", background: "rgba(0,0,0,0.20)" }}>
                        Covered canopy
                      </div>
                      <div style={{ borderRadius: 999, padding: "8px 12px", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.88)", background: "rgba(0,0,0,0.20)" }}>
                        Cold plunges coming
                      </div>
                    </div>

                    <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button type="button" className="ia-btn ia-btn-primary" style={{ borderRadius: 14, minHeight: 48, padding: "10px 16px", minWidth: 220 }} onClick={scrollToForm}>
                        Join the waitlist
                      </button>
                      <button type="button" className="ia-btn ia-btn-outline" style={{ borderRadius: 14, minHeight: 48, padding: "10px 16px", minWidth: 220 }} onClick={() => window.scrollTo({ top: 700, behavior: "smooth" })}>
                        See the space
                      </button>
                    </div>

                    <div style={{ marginTop: 10, color: "rgba(255,255,255,0.65)", fontSize: 12 }}>
                      No payment taken until one month after opening. Waitlist is free — it just keeps you in the loop and gives first refusal on founders.
                    </div>
                  </div>
                </div>

                <div style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 13 }}>
                    Tip: keep the meadow video portrait. iOS autoplay works best with muted + playsInline (already set).
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-5" ref={formRef}>
                <div style={{ padding: 18 }}>
                  <div className="ia-tile ia-tile-pad" style={{ borderRadius: 18, background: "#0b0f14", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ color: "#fff", fontWeight: 950, fontSize: 18 }}>Join the waitlist</div>
                    <div style={{ color: "rgba(255,255,255,0.72)", marginTop: 6, lineHeight: 1.35 }}>
                      Founders offer is limited to the first 20. Waitlist gets the invite first.
                    </div>

                    <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                      <input className="form-control" style={{ minHeight: 46, background: "#070a0f", color: "#fff", borderColor: "rgba(255,255,255,0.12)" }} placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
                      <input className="form-control" style={{ minHeight: 46, background: "#070a0f", color: "#fff", borderColor: "rgba(255,255,255,0.12)" }} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoCapitalize="none" />
                      <input className="form-control" style={{ minHeight: 46, background: "#070a0f", color: "#fff", borderColor: "rgba(255,255,255,0.12)" }} placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />

                      <select className="form-select" style={{ minHeight: 46, background: "#070a0f", color: "#fff", borderColor: "rgba(255,255,255,0.12)" }} value={goal} onChange={(e) => setGoal(e.target.value)}>
                        <option value="Strength">Primary goal: Strength</option>
                        <option value="Fat loss">Primary goal: Fat loss</option>
                        <option value="Conditioning">Primary goal: Conditioning</option>
                        <option value="Boxing">Primary goal: Boxing</option>
                        <option value="General fitness">Primary goal: General fitness</option>
                      </select>

                      <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 12, background: "rgba(255,255,255,0.02)" }}>
                        <div style={{ color: "#fff", fontWeight: 900, marginBottom: 8 }}>Interested in</div>
                        <div className="d-flex flex-wrap" style={{ gap: 8 }}>
                          {CLASSES.map((c) => {
                            const on = interests.includes(c.key);
                            return (
                              <button
                                key={c.key}
                                type="button"
                                className={on ? "ia-btn ia-btn-primary" : "ia-btn ia-btn-outline"}
                                style={{ borderRadius: 999, minHeight: 40, padding: "8px 12px" }}
                                onClick={() => toggleInterest(c.key)}
                              >
                                {c.name}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ color: "rgba(255,255,255,0.58)", fontSize: 12, marginTop: 8 }}>
                          This helps us schedule the first blocks and invite you to the right sessions.
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

                      <button type="button" className="ia-btn ia-btn-primary" style={{ borderRadius: 14, minHeight: 48, padding: "10px 16px" }} disabled={loading} onClick={submit}>
                        {loading ? "Joining…" : "Join the waitlist"}
                      </button>

                      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>
                        No payment taken until one month after opening. You can unsubscribe anytime.
                      </div>
                    </div>
                  </div>

                  <div className="ia-tile" style={{ marginTop: 12, borderRadius: 18, padding: 14, border: "1px solid rgba(255,255,255,0.06)", background: "#0b0f14" }}>
                    <div style={{ color: "#fff", fontWeight: 950, fontSize: 16 }}>Founders offer</div>
                    <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.82)" }}>
                        <span style={{ fontWeight: 900, color: "#fff" }}>£60/month</span>
                        <span>locked for life</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.72)" }}>
                        <span>Limited to first 20 people</span>
                        <span style={{ color: "rgba(255,255,255,0.85)" }}>then closes</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "rgba(255,255,255,0.72)" }}>
                        <span>Standard price</span>
                        <span style={{ color: "#fff", fontWeight: 900 }}>£100/month</span>
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
                        First payment is taken one month after opening. Waitlist gets founders invites first.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14 }} />

          <div className="ia-tile ia-tile-pad" style={{ borderRadius: 18, background: "#0b0f14", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ color: "#fff", fontWeight: 950, fontSize: 18 }}>Concept</div>
              <div style={{ color: "rgba(255,255,255,0.60)", fontSize: 13 }}>Add images at /public/waitlist/concept-1.jpg and concept-2.jpg</div>
            </div>

            <div className="row g-3" style={{ marginTop: 4 }}>
              <div className="col-12 col-md-6">
                <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", background: "#070a0f" }}>
                  <div style={{ position: "relative", width: "100%", aspectRatio: "16/10" as any }}>
                    <Image src={concept1Src} alt="Iron Acre Gym concept 1" fill style={{ objectFit: "cover" }} priority />
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-6">
                <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)", background: "#070a0f" }}>
                  <div style={{ position: "relative", width: "100%", aspectRatio: "16/10" as any }}>
                    <Image src={concept2Src} alt="Iron Acre Gym concept 2" fill style={{ objectFit: "cover" }} />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, color: "rgba(255,255,255,0.72)", lineHeight: 1.45 }}>
              Built on an old menage overlooking a meadow. A covered canopy training floor with storage and kit built into the containers. This is the start — we’ll keep expanding.
            </div>
          </div>

          <div style={{ marginTop: 14 }} />

          <div className="ia-tile ia-tile-pad" style={{ borderRadius: 18, background: "#0b0f14", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ color: "#fff", fontWeight: 950, fontSize: 18 }}>Classes</div>
            <div style={{ color: "rgba(255,255,255,0.72)", marginTop: 6 }}>
              Small groups, coached properly. Strength, engine work and bags, with the view right in front of you.
            </div>

            <div className="row g-3" style={{ marginTop: 6 }}>
              {CLASSES.map((c) => (
                <div key={c.key} className="col-12 col-md-6 col-lg-4">
                  <div className="ia-tile" style={{ borderRadius: 16, padding: 14, background: "#070a0f", border: "1px solid rgba(255,255,255,0.06)", height: "100%" }}>
                    <div style={{ color: "#fff", fontWeight: 950, fontSize: 16 }}>{c.name}</div>
                    <div style={{ color: "rgba(255,255,255,0.72)", marginTop: 6, lineHeight: 1.35, fontSize: 14 }}>{c.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button type="button" className="ia-btn ia-btn-primary" style={{ borderRadius: 14, minHeight: 46, padding: "10px 14px" }} onClick={scrollToForm}>
                Join the waitlist
              </button>
              <div style={{ color: "rgba(255,255,255,0.60)", fontSize: 13, alignSelf: "center" }}>
                Want founders? Tick the founders box on the form.
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14 }} />

          <div className="ia-tile ia-tile-pad" style={{ borderRadius: 18, background: "#0b0f14", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ color: "#fff", fontWeight: 950, fontSize: 18 }}>FAQ</div>

            <div className="row g-3" style={{ marginTop: 6 }}>
              <div className="col-12 col-md-6">
                <div className="ia-tile" style={{ borderRadius: 16, padding: 14, background: "#070a0f", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color: "#fff", fontWeight: 900 }}>Where is it?</div>
                  <div style={{ color: "rgba(255,255,255,0.72)", marginTop: 6 }}>Ipswich area, set on an old menage overlooking a meadow with sheep and cows.</div>
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
                  <div style={{ color: "#fff", fontWeight: 900 }}>What if it rains?</div>
                  <div style={{ color: "rgba(255,255,255,0.72)", marginTop: 6 }}>The training area is covered. The space is designed for outdoor conditions.</div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="ia-tile" style={{ borderRadius: 16, padding: 14, background: "#070a0f", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color: "#fff", fontWeight: 900 }}>Do I need to be fit already?</div>
                  <div style={{ color: "rgba(255,255,255,0.72)", marginTop: 6 }}>No. Everything is coached and scaled so you can start where you are.</div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="ia-tile" style={{ borderRadius: 16, padding: 14, background: "#070a0f", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color: "#fff", fontWeight: 900 }}>How does founders work?</div>
                  <div style={{ color: "rgba(255,255,255,0.72)", marginTop: 6 }}>First 20 people to accept the founders invite get £60/month locked for life. After that it’s £100/month.</div>
                </div>
              </div>

              <div className="col-12 col-md-6">
                <div className="ia-tile" style={{ borderRadius: 16, padding: 14, background: "#070a0f", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ color: "#fff", fontWeight: 900 }}>When is the first payment taken?</div>
                  <div style={{ color: "rgba(255,255,255,0.72)", marginTop: 6 }}>One month after opening. The waitlist is free until then.</div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button type="button" className="ia-btn ia-btn-primary" style={{ borderRadius: 14, minHeight: 46, padding: "10px 14px" }} onClick={scrollToForm}>
                Join the waitlist
              </button>
              <div style={{ color: "rgba(255,255,255,0.60)", fontSize: 13, alignSelf: "center" }}>
                Founders is limited to 20 — the earlier you join, the better your chances.
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18, color: "rgba(255,255,255,0.5)", fontSize: 12, textAlign: "center" }}>
            © {new Date().getFullYear()} Iron Acre Gym
          </div>
        </div>

        <style jsx>{`
          @media (max-width: 991px) {
            .row.g-0 > .col-12.col-lg-7 > div {
              height: 640px !important;
            }
          }
          @media (max-width: 480px) {
            .row.g-0 > .col-12.col-lg-7 > div {
              height: 720px !important;
            }
          }
        `}</style>
      </div>
    </>
  );
}
