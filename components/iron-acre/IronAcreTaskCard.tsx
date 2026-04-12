const NEON = "#18ff9a";
const NEON_2 = "#00e5ff";

export default function IronAcreTaskCard({
  title,
  subtitle,
  ctaLabel,
  onCta,
  rightMeta,
  muted,
  variant = "neon",
}: {
  title: string;
  subtitle: string;
  ctaLabel: string;
  onCta: () => void;
  rightMeta?: string;
  muted?: boolean;
  variant?: "neon" | "classic";
}) {
  const isNeon = variant === "neon";

  return (
    <section
      className="futuristic-card p-3 mb-2"
      style={{
        border: isNeon ? `1px solid ${NEON}22` : `1px solid rgba(34,197,94,0.20)`,
        background: isNeon
          ? "linear-gradient(180deg, rgba(0,0,0,0.38), rgba(0,0,0,0.18))"
          : undefined,
        boxShadow: isNeon ? `0 0 0 1px ${NEON}12 inset, 0 0 18px ${NEON}10` : undefined,
        opacity: muted ? 0.75 : 1,
      }}
    >
      <div className="d-flex justify-content-between align-items-center gap-2">
        <div style={{ minWidth: 0 }}>
          <div className="fw-semibold">{title}</div>
          <div className="text-dim small">{subtitle}</div>
        </div>

        <div className="d-flex align-items-center gap-2">
          {rightMeta ? <div className="text-dim small">{rightMeta}</div> : null}

          <button
            type="button"
            className="btn btn-sm"
            style={{
              borderRadius: 12,
              background: isNeon ? `linear-gradient(90deg, ${NEON}, ${NEON_2})` : "#22c55e",
              color: "#06110c",
              fontWeight: 900,
              whiteSpace: "nowrap",
              boxShadow: isNeon ? `0 0 18px ${NEON}30` : undefined,
              border: "none",
              paddingLeft: 14,
              paddingRight: 14,
            }}
            onClick={onCta}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
