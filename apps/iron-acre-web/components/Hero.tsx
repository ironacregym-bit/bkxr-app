import LeadCapture from "./LeadCapture";

export default function Hero() {
  return (
    <section className="ia-hero">

      <div className="ia-overlay" />

      <div className="ia-container">

        <div className="ia-nav">

          <div className="ia-brand">

            <img
              src="/images/logo-white.png"
              alt="Iron Acre Gym"
            />

            <span>
              Iron Acre Gym
            </span>

          </div>

          <a
            href="#start"
            className="ia-btn"
          >
            Start Free
          </a>

        </div>

        <div className="ia-hero-grid">

          <div>

            <div className="ia-eyebrow">
              Westerfield, Ipswich
            </div>

            <h1>
              GET FARM
              <br />
              STRONG.
            </h1>

            <p className="ia-lead">
              An outdoor gym in Westerfield,
              Ipswich, overlooking an open
              meadow. Sandbags, kettlebells,
              yokes and sleds, coached for
              everyday people.
            </p>

          </div>

          <LeadCapture />

        </div>

      </div>

    </section>
  );
}
