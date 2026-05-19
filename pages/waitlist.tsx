// File: pages/waitlist.tsx
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
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

export default function WaitlistPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [goal, setGoal] = useState("Strength");
  const [consent, setConsent] = useState(true);

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
    } catch (e: any) {
      setError("Could not join the waitlist. Try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Iron Acre Gym Outdoor Gym Waitlist</title>
        <meta name="description" content="Join the Iron Acre Gym outdoor gym waitlist. Get early access, founding pricing, and first pick of sessions." />
        <meta property="og:title" content="Iron Acre Gym Outdoor Gym Waitlist" />
        <meta property="og:description" content="Small group coaching in a covered outdoor container gym. Join the waitlist for early access." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ minHeight: "100vh", background: "#070a0f" }}>
        <div className="container" style={{ paddingTop: 28, paddingBottom: 40, maxWidth: 980 }}>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div style={{ color: "#fff", fontWeight: 800, letterSpacing: 0.2, fontSize: 18 }}>Iron Acre Gym</div>
            <div className="text-dim small" style={{ color: "rgba(255,255,255,0.7)" }}>
              Ipswich Outdoor Gym
            </div>
          </div>

          <div
            className="ia-tile ia-tile-pad"
            style={{
              borderRadius: 18,
              padding: 18,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
            }}
          >
            <div className="row g-3 align-items-center">
              <div className="col-12 col-lg-6">
                <div style={{ color: "#fff", fontSize: 40, lineHeight: 1.05, fontWeight: 900 }}>
                  Train outdoors.
                  <br />
                  Get strong.
                  <br />
                  Feel unreal.
                </div>

                <div style={{ color: "rgba(255,255,255,0.78)", marginTop: 12, fontSize: 16, lineHeight: 1.4 }}>
                  A covered outdoor container gym built for small group coached sessions.
                  <span style={{ color: "#fff" }}> Strength, conditioning and bags</span> in nature.
                </div>

                <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ borderRadius: 999, padding: "8px 12px", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.85)" }}>
                    Max 12 per session
                  </div>
                  <div style={{ borderRadius: 999, padding: "8px 12px", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.85)" }}>
                    Founding spots limited
                  </div>
                  <div style={{ borderRadius: 999, padding: "8px 12px", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.85)" }}>
                    No spam
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="ia-btn ia-btn-primary"
                    style={{ borderRadius: 14, minHeight: 48, padding: "10px 16px", width: "100%", maxWidth: 360 }}
                    onClick={() => {
                      const el = document.getElementById("waitlist-form");
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    Join the waitlist
                  </button>
                </div>
              </div>

              <div className="col-12 col-lg-6">
                <div
                  className="ia-tile"
                  style={{
                    borderRadius: 16,
                    padding: 0,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "#0b0f14",
                  }}
                >
                  <div
                    style={{
                      height: 280,
                      background:
                        "radial-gradient(1200px 500px at 20% 20%, rgba(0,255,170,0.20), transparent 55%), radial-gradient(1200px 500px at 80% 0%, rgba(110,168,255,0.16), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "rgba(255,255,255,0.75)",
                      textAlign: "center",
                      padding: 18,
                    }}
                  >
                    Put your advert render into /public and replace this block with an image.
                  </div>
                  <div style={{ padding: 14, color: "rgba(255,255,255,0.78)", fontSize: 14 }}>
                    Covered canopy, woodland views, proper kit storage, and a clean training floor.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div id="waitlist-form" className="row g-3" style={{ marginTop: 18 }}>
            <div className="col-12 col-lg-7">
              <div
                className="ia-tile ia-tile-pad"
                style={{
                  borderRadius: 18,
                  padding: 18,
                  background: "#0b0f14",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>Get early access</div>
                <div style={{ color: "rgba(255,255,255,0.72)", marginTop: 6 }}>
                  Join the waitlist for opening updates, founding membership pricing, and priority taster booking.
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
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
                    <option value="Strength">Strength</option>
                    <option value="Fat loss">Fat loss</option>
                    <option value="Conditioning">Conditioning</option>
                    <option value="Boxing">Boxing</option>
                    <option value="General fitness">General fitness</option>
                  </select>

                  <label style={{ display: "flex", gap: 10, alignItems: "flex-start", color: "rgba(255,255,255,0.75)", fontSize: 14 }}>
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
                    I agree to receive updates about Iron Acre Gym opening dates and sessions.
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

                  <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 12 }}>You can unsubscribe anytime. We store your details securely.</div>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-5">
              <div
                className="ia-tile ia-tile-pad"
                style={{
                  borderRadius: 18,
                  padding: 18,
                  background: "#0b0f14",
                  border: "1px solid rgba(255,255,255,0.06)",
                  height: "100%",
                }}
              >
                <div style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>What you’ll train</div>
                <div style={{ marginTop: 10, display: "grid", gap: 10, color: "rgba(255,255,255,0.78)" }}>
                  <div>Strength training with proper kit and coaching</div>
                  <div>Conditioning sessions and outdoor circuits</div>
                  <div>Punch bags under canopy for boxing finishers</div>
                  <div>Small groups so you actually get coached</div>
                </div>

                <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
                  <div style={{ color: "#fff", fontWeight: 900, fontSize: 16 }}>FAQ</div>
                  <div style={{ marginTop: 10, display: "grid", gap: 10, color: "rgba(255,255,255,0.72)", fontSize: 14 }}>
                    <div>
                      <span style={{ color: "#fff", fontWeight: 800 }}>Where?</span> Ipswich area.
                    </div>
                    <div>
                      <span style={{ color: "#fff", fontWeight: 800 }}>When?</span> Opening updates go to the waitlist first.
                    </div>
                    <div>
                      <span style={{ color: "#fff", fontWeight: 800 }}>All levels?</span> Yes. Everything is coached and scaled.
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="ia-btn ia-btn-outline"
                    style={{ borderRadius: 14, minHeight: 46, padding: "10px 14px", width: "100%" }}
                    onClick={() => {
                      const el = document.getElementById("waitlist-form");
                      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    Join the waitlist
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18, color: "rgba(255,255,255,0.5)", fontSize: 12, textAlign: "center" }}>
            © {new Date().getFullYear()} Iron Acre Gym
          </div>
        </div>
      </div>
    </>
  );
}
