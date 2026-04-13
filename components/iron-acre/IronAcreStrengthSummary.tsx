import { IA, neonCardStyle } from "./theme";

export default function IronAcreStrengthSummary({ profile }: { profile?: any }) {
  const maxes = profile?.training_maxes || {};
  const keys = Object.keys(maxes || {}).slice(0, 6);

  return (
    <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="m-0">Strength</h6>

        <span
          className="badge"
          style={{
            background: `rgba(24,255,154,0.12)`,
            color: IA.neon,
            border: `1px solid ${IA.borderSoft}`,
          }}
        >
          1RMs
        </span>
      </div>

      {keys.length === 0 ? (
        <div className="text-dim small">No 1RM values yet. Add maxes to see % targets.</div>
      ) : (
        <div className="d-flex flex-column" style={{ gap: 10 }}>
          {keys.map((k) => (
            <div
              key={k}
              className="d-flex justify-content-between align-items-center"
              style={{
                paddingTop: 8,
                borderTop: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div className="fw-semibold" style={{ textTransform: "capitalize" }}>
                {k.replaceAll("_", " ")}
              </div>

              <div className="text-dim">
                <span style={{ color: IA.neon, fontWeight: 900, textShadow: `0 0 10px ${IA.neon}40` }}>
                  {maxes[k]}
                </span>{" "}
                kg
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
