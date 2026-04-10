const ACCENT_IRON = "#22c55e";

export default function IronAcreTaskCard({
  title,
  subtitle,
  ctaLabel,
  onCta,
  rightMeta,
}: {
  title: string;
  subtitle: string;
  ctaLabel: string;
  onCta: () => void;
  rightMeta?: string;
}) {
  return (
    <section className="futuristic-card p-3 mb-2" style={{ border: `1px solid ${ACCENT_IRON}33` }}>
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
              background: ACCENT_IRON,
              color: "#0b0f14",
              fontWeight: 700,
              whiteSpace: "nowrap",
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
