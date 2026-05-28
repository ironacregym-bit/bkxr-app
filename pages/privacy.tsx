// File: pages/privacy.tsx
import Head from "next/head";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <>
      <Head>
        <title>Privacy Policy • Iron Acre Gym</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="ia-app container py-4 ia-legal">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <img
            src="/IronAcreLogoNoBG.png"
            alt="Iron Acre Gym"
            height={40}
            style={{ borderRadius: 8 }}
          />

          <Link href="/" className="ia-btn-outline">
            Back
          </Link>
        </div>

        <h1 className="ia-page-title">Privacy Policy</h1>
        <p className="text-dim small">Last updated: {new Date().getFullYear()}</p>

        <section>
          <h2>Overview</h2>
          <p>
            Iron Acre Gym is committed to protecting your privacy. This policy explains what
            information we collect, how we use it, and how we keep it safe.
          </p>
        </section>

        <section>
          <h2>Information we collect</h2>
          <ul>
            <li>Personal details (name, email)</li>
            <li>Health screening data (PAR-Q responses)</li>
            <li>Emergency contact information</li>
            <li>Workout and strength performance data</li>
            <li>Optional photos/videos (if consent given)</li>
            <li>Technical data (IP address, device info)</li>
          </ul>
        </section>

        <section>
          <h2>How we use your data</h2>
          <ul>
            <li>To provide safe and effective coaching</li>
            <li>To personalise workouts and track progress</li>
            <li>To contact you about your membership</li>
            <li>To ensure health and safety compliance</li>
            <li>To improve our services</li>
          </ul>
        </section>

        <section>
          <h2>Health information</h2>
          <p>
            Health-related data (such as PAR-Q responses) is used strictly to assess your readiness
            for physical activity and to help coaches deliver safe training.
          </p>
        </section>

        <section>
          <h2>Photos and media</h2>
          <p>
            Photos and videos are only used if you explicitly consent. You can withdraw this consent
            at any time by contacting us.
          </p>
        </section>

        <section>
          <h2>Data storage</h2>
          <p>
            Your data is securely stored using trusted cloud services. We take reasonable measures
            to protect your information from unauthorised access.
          </p>
        </section>

        <section>
          <h2>Sharing of data</h2>
          <p>
            We do not sell or share your personal data with third parties except where required for:
          </p>
          <ul>
            <li>Service provision (e.g. hosting, authentication)</li>
            <li>Legal obligations</li>
          </ul>
        </section>

        <section>
          <h2>Your rights</h2>
          <ul>
            <li>Request access to your data</li>
            <li>Request correction or deletion</li>
            <li>Withdraw consent at any time</li>
          </ul>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            If you have any questions about this policy, please contact Iron Acre Gym directly.
          </p>
        </section>

        <footer className="text-center small text-dim mt-5">
          © {new Date().getFullYear()} Iron Acre Gym ·{" "}
          <Link href="/terms">Terms</Link>
        </footer>

        <style jsx>{`
          .ia-legal {
            color: #fff;
            background: linear-gradient(to bottom, #070a0d 0%, #0d1416 55%, #111a16 100%);
            min-height: 100vh;
          }

          section {
            margin-top: 24px;
          }

          h2 {
            font-size: 16px;
            margin-bottom: 6px;
            color: var(--ia-neon);
          }

          p, li {
            color: rgba(255,255,255,0.85);
            line-height: 1.6;
          }

          ul {
            padding-left: 18px;
          }

          .text-dim {
            color: var(--ia-muted);
          }
        `}</style>
      </main>
    </>
  );
}
