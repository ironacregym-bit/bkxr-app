// File: pages/terms.tsx
import Head from "next/head";
import Link from "next/link";

export default function TermsPage() {
  return (
    <>
      <Head>
        <title>Terms & Conditions • Iron Acre Gym</title>
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

        <h1 className="ia-page-title">Terms & Conditions</h1>
        <p className="text-dim small">Last updated: {new Date().getFullYear()}</p>

        <section>
          <h2>Acceptance of terms</h2>
          <p>
            By participating in training at Iron Acre Gym, you agree to these terms.
          </p>
        </section>

        <section>
          <h2>Health and responsibility</h2>
          <p>
            You confirm that you are physically able to take part in exercise or have sought medical
            advice where necessary. You agree to inform coaches of any changes to your health.
          </p>
        </section>

        <section>
          <h2>Assumption of risk</h2>
          <p>
            Physical training carries inherent risks including injury. You voluntarily accept these
            risks by participating in sessions and using equipment.
          </p>
        </section>

        <section>
          <h2>Coaching and conduct</h2>
          <ul>
            <li>Follow all coach instructions</li>
            <li>Use equipment safely and responsibly</li>
            <li>Respect other members and the environment</li>
          </ul>
        </section>

        <section>
          <h2>Membership and payments</h2>
          <p>
            Membership terms, pricing and cancellations are outlined at sign-up. Failure to adhere
            to payment terms may result in access being restricted.
          </p>
        </section>

        <section>
          <h2>Outdoor training environment</h2>
          <p>
            Iron Acre Gym operates in an outdoor setting. Conditions may vary, including uneven
            ground and weather changes. You accept these environmental risks.
          </p>
        </section>

        <section>
          <h2>Media consent</h2>
          <p>
            Photos or videos may be taken during sessions. These will only be used where consent has
            been provided.
          </p>
        </section>

        <section>
          <h2>Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, Iron Acre Gym is not liable for injuries or loss
            sustained during participation, except where caused by negligence.
          </p>
        </section>

        <section>
          <h2>Changes to terms</h2>
          <p>
            We may update these terms from time to time. Continued participation indicates
            acceptance of any updates.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            For questions regarding these terms, contact Iron Acre Gym.
          </p>
        </section>

        <footer className="text-center small text-dim mt-5">
          © {new Date().getFullYear()} Iron Acre Gym ·{" "}
          <Link href="/privacy">Privacy</Link>
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
