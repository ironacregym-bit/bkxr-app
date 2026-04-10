const ACCENT_IRON = "#22c55e";

export default function IronAcreStrengthSummary({ profile }: { profile?: any }) {
  const maxes = profile?.training_maxes || {};
  const keys = Object.keys(maxes || {}).slice(0, 6);

  return (
    <section className="futuristic-card p-3 mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="m-0">Strength</h6>
        <span
          className="badge"
          style={{
            background: `${ACCENT_IRON}22`,
            color: ACCENT_IRON,
            border: `1px solid ${ACCENT_IRON}55`,
          }}
        >
          1RMs
        </span>
      </div>

      {keys.length === 0 ? (
        <div className="text-dim small">No 1RM values yet. Add maxes to see % targets.</div>
      ) : (
        <div className="d-flex flex-column" style={{ gap: 8 }}>
          {keys.map((k) => (
            <div key={k} className="d-flex justify-content-between align-items-center">
              <div className="fw-semibold" style={{ textTransform: "capitalize" }}>
                {k.replaceAll("_", " ")}
              </div>
              <div className="text-dim">
                <span className="fw-semibold" style={{ color: "#fff" }}>
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
