// File: pages/waitlist.tsx
import Head from "next/head";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/router";

export default function WaitlistPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [founders, setFounders] = useState(true);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.includes("@")) return;

    setLoading(true);

    await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        founders_interest: founders
      })
    });

    router.push(`/waitlist/thanks?email=${email}`);
  }

  return (
    <>
      <Head>
        <title>Iron Acre Gym</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ background: "#06090d", minHeight: "100vh", color: "#fff" }}>
        
        {/* HERO */}
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 16px" }}>
          
          <div style={{ marginBottom: 12, fontWeight: 700 }}>
            Iron Acre Gym
          </div>

          <div className="hero">
            <Image
              src="/concept-1.jpg"
              alt="Iron Acre"
              fill
              style={{ objectFit: "cover" }}
              priority
            />

            <div className="overlay" />

            <div className="content">
              <div className="title">
                Train outdoors.<br />
                Limited founders spots.
              </div>

              <div className="sub">
                £60/month locked for life. First 20 only.<br />
                Usually £100/month.
              </div>

              <div className="form">
                <input
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                <label>
                  <input
                    type="checkbox"
                    checked={founders}
                    onChange={(e) => setFounders(e.target.checked)}
                  />
                  I want a founders spot
                </label>

                <button onClick={submit} disabled={loading}>
                  {loading ? "Joining..." : "Join waitlist"}
                </button>
              </div>

              <div className="fine">
                No payment until one month after opening
              </div>
            </div>
          </div>

          {/* LIGHT INFO (NOT HEAVY) */}
          <div className="benefits">
            <div>Max 12 per session</div>
            <div>Outdoor meadow setting</div>
            <div>Strength, conditioning and boxing</div>
          </div>

          <div className="concept">
            <Image
              src="/concept-2.jpg"
              alt="Concept"
              width={1200}
              height={700}
              style={{ width: "100%", height: "auto", borderRadius: 16 }}
            />
            <p>Built on an old menage overlooking a meadow</p>
          </div>

        </div>
      </div>

      <style jsx>{`
        .hero {
          position: relative;
          height: 540px;
          border-radius: 20px;
          overflow: hidden;
        }

        .overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.85));
        }

        .content {
          position: absolute;
          bottom: 0;
          padding: 20px;
          width: 100%;
        }

        .title {
          font-size: 38px;
          font-weight: 900;
          line-height: 1.1;
        }

        .sub {
          margin-top: 10px;
          color: rgba(255,255,255,0.85);
        }

        .form {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 16px;
        }

        input {
          height: 48px;
          border-radius: 12px;
          border: none;
          padding: 0 12px;
          background: rgba(255,255,255,0.1);
          color: white;
        }

        button {
          height: 48px;
          border-radius: 12px;
          border: none;
          background: #1fe0a5;
          color: #000;
          font-weight: 700;
        }

        label {
          font-size: 14px;
          opacity: 0.8;
          display: flex;
          gap: 8px;
        }

        .fine {
          margin-top: 10px;
          font-size: 12px;
          opacity: 0.6;
        }

        .benefits {
          display: grid;
          gap: 8px;
          margin-top: 20px;
          opacity: 0.85;
        }

        .concept {
          margin-top: 20px;
        }

        .concept p {
          margin-top: 8px;
          opacity: 0.7;
        }
      `}</style>
    </>
  );
}
