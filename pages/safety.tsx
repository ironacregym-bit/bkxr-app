// File: pages/safety.tsx
import Head from "next/head";
import Link from "next/link";

export default function SafetyPage() {
  return (
    <>
      <Head>
        <title>Safety Information • Iron Acre Gym</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main
        className="ia-app container py-4 ia-safety-page"
        style={{
          minHeight: "100vh",
          paddingBottom: 80,
          color: "#fff",
          background: "linear-gradient(to bottom, #070a0d 0%, #0d1416 55%, #111a16 100%)",
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="d-flex align-items-center gap-2">
            <img
              src="/IronAcreLogoNoBG.png"
              alt="Iron Acre Gym"
              height={42}
              style={{ display: "block", borderRadius: 8 }}
            />
          </div>
          <Link href="/" className="ia-btn-outline">
            Back
          </Link>
        </div>
        <section className="mb-4">
          <div className="ia-kicker">Public Information</div>
          <h1 className="ia-page-title mt-2">
            Safety{" "}
            <span
              style={{
                color: "var(--ia-neon)",
                textShadow: "0 0 16px rgba(24,255,154,0.18)",
              }}
            >
              Iron Acre Gym
            </span>
          </h1>
          <p className="ia-page-subtitle">
            Please read this page before attending. Our aim is to create a safe, welcoming and well-run training environment for every member and visitor.
          </p>
        </section>
        <section className="ia-tile ia-tile-pad mb-3">
          <div className="ia-section">
            <h2 className="ia-section-title">Emergency procedures</h2>
            <p className="ia-copy">
              If there is a serious injury, medical emergency, fire or any situation where immediate assistance is needed, stop training straight away and alert a coach or member of staff immediately.
            </p>
            <p className="ia-copy">
              If urgent medical help is required, call <strong>999</strong> and clearly provide the site location details to the emergency operator. If safe to do so, one person should remain with the injured person while another directs emergency services to the correct access point.
            </p>
            <p className="ia-copy">
              Do not move an injured person unless they are in immediate danger. Keep the surrounding area clear and follow coach or emergency responder instructions at all times.
            </p>
            <p className="ia-copy">
              All accidents, near misses and incidents should be reported to Iron Acre Gym as soon as possible so they can be logged and reviewed properly.
            </p>
          </div>
          <div className="ia-divider" />
          <div className="ia-section">
            <h2 className="ia-section-title">Site rules</h2>
            <ul className="ia-list">
              <li>Train responsibly and within your ability.</li>
              <li>Follow all coach instruction at all times.</li>
              <li>Use equipment only for its intended purpose.</li>
              <li>Do not use damaged equipment and report any faults immediately.</li>
              <li>Wear suitable footwear and clothing for training and outdoor ground conditions.</li>
              <li>Keep walkways, lifting areas and entrances clear.</li>
              <li>Return equipment after use and help keep the site tidy.</li>
              <li>Respect other members, coaches, neighbours, animals and the surrounding environment.</li>
              <li>No abusive, reckless or unsafe behaviour will be tolerated.</li>
              <li>Children must be supervised at all times unless taking part in an organised session.</li>
              <li>Do not attend training if you feel unwell or unable to exercise safely.</li>
            </ul>
          </div>
          <div className="ia-divider" />
          <div className="ia-section">
            <h2 className="ia-section-title">Severe weather policy</h2>
            <p className="ia-copy">
              Iron Acre Gym operates in an outdoor environment. Training may be adjusted, delayed or cancelled where weather conditions create an unreasonable safety risk.
            </p>
            <p className="ia-copy">
              This may include high winds, lightning, electrical storms, flooding, extreme ice, snow, poor visibility, dangerous heat or any other condition that makes the site or equipment unsafe to use.
            </p>
            <p className="ia-copy">
              If severe weather develops during a session, coaches may stop training, modify the session or ask members to leave the training area immediately. All participants must follow staff instruction without delay.
            </p>
            <p className="ia-copy">
              Where possible, updates on cancellations or changes will be communicated in advance through the usual Iron Acre Gym communication channels.
            </p>
          </div>
          <div className="ia-divider" />
          <div className="ia-section">
            <h2 className="ia-section-title">Contact information</h2>
            <p className="ia-copy">
              For general questions, safety concerns or to report an incident, please contact Iron Acre Gym directly.
            </p>
            <div className="ia-contact-box">
              <div className="ia-contact-row">
                <span className="ia-contact-label">Email</span>
                <span className="ia-contact-value">hello@ironacregym.co.uk</span>
              </div>
              <div className="ia-contact-row">
                <span className="ia-contact-label">Instagram</span>
                <span className="ia-contact-value">@ironacregym</span>
              </div>
              <div className="ia-contact-row">
                <span className="ia-contact-label">Emergency</span>
                <span className="ia-contact-value">Call 999 if urgent</span>
              </div>
            </div>
            <p className="ia-copy ia-copy-small">
              If you want, we can swap these contact details for your exact live business email, phone number and any site location wording you want shown publicly.
            </p>
          </div>
        </section>
        <footer className="text-center small text-dim">
          © {new Date().getFullYear()} Iron Acre Gym · <Link href="/privacy">Privacy</Link> ·{" "}
          <Link href="/terms">Terms</Link>
        </footer>
        <style jsx>{`
          .text-dim {
            color: var(--ia-muted);
          }

          .ia-safety-page :global(a) {
            color: var(--ia-neon);
            text-decoration: none;
          }

          .ia-section + .ia-section {
            margin-top: 0;
          }

          .ia-section-title {
            font-size: 1rem;
            font-weight: 800;
            margin: 0 0 12px;
            color: #fff;
          }

          .ia-copy {
            color: rgba(255,255,255,0.86);
            line-height: 1.65;
            margin: 0 0 12px;
          }

          .ia-copy-small {
            font-size: 0.92rem;
            color: var(--ia-muted);
            margin-bottom: 0;
          }

          .ia-list {
            margin: 0;
            padding-left: 18px;
            color: rgba(255,255,255,0.86);
          }

          .ia-list li {
            margin-bottom: 10px;
            line-height: 1.55;
          }

          .ia-divider {
            height: 1px;
            background: rgba(255,255,255,0.08);
            margin: 20px 0;
          }

          .ia-contact-box {
            display: grid;
            gap: 10px;
            margin-top: 12px;
          }

          .ia-contact-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: center;
            padding: 12px 14px;
            border-radius: 14px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.08);
          }

          .ia-contact-label {
            color: var(--ia-muted);
            font-weight: 700;
          }

          .ia-contact-value {
            color: #fff;
            text-align: right;
            font-weight: 700;
          }

          @media (max-width: 575.98px) {
            .ia-contact-row {
              flex-direction: column;
              align-items: flex-start;
            }

            .ia-contact-value {
              text-align: left;
            }
          }
        `}</style>
      </main>
    </>
  );
}
