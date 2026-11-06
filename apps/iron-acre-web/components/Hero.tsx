import LeadCapture from "./LeadCapture";

export default function Hero() {
  return (
    <section className="ia-hero">

      <div className="ia-container">

        <div className="ia-hero-grid">

          <div>

            <div className="ia-eyebrow">
              Westerfield, Ipswich
            </div>

            <h1>
              Get Farm Strong.
            </h1>

            <p className="ia-lead">
              Outdoor farm strength and conditioning
              overlooking the meadow.
            </p>

            <p className="ia-copy">
              Sandbags. Sleds. Yokes. Kettlebells.
              Real coaching. Real community.
              Train outdoors in Westerfield and build
              strength that carries into everyday life.
            </p>

            <div className="ia-actions">
              <a
                href="#class"
                className="ia-btn"
              >
                View Classes
              </a>

              <a
                href="#coach"
                className="ia-btn ia-btn-ghost"
              >
                Meet Rob
              </a>
            </div>

          </div>

          <LeadCapture />

        </div>

      </div>

    </section>
  );
}
