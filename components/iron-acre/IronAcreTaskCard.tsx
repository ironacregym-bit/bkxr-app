import { IA, neonCardStyle, neonPrimaryStyle } from "./theme";

export default function IronAcreTaskCard({
  title,
  subtitle,
  ctaLabel,
  onCta,
  rightMeta,
  muted,
  variant = "neon",
  highlight = false,
}: {
  title: string;
  subtitle: string;
  ctaLabel: string;
  onCta: () => void;
  rightMeta?: string;
  muted?: boolean;
  variant?: "neon" | "classic";
  highlight?: boolean;
}) {
  const isNeon = variant === "neon";

  return (
    <section
      className="futuristic-card p-3 mb-2"
      style={
        isNeon
          ? neonCardStyle({
              opacity: muted ? 0.75 : 1,
              border: highlight ? `1px solid ${IA.neon}` : `1px solid ${IA.borderSoft}`,
              boxShadow: highlight
                ? `0 0 0 1px rgba(24,255,154,0.20) inset, 0 0 26px rgba(24,255,154,0.20)`
                : `0 0 0 1px rgba(24,255,154,0.07) inset, 0 18px 40px rgba(0,0,0,0.45)`,
            })
          : {
              border: `1px solid rgba(34,197,94,0.20)`,
              opacity: muted ? 0.75 : 1,
            }
      }
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
            style={isNeon ? neonPrimaryStyle({ paddingLeft: 14, paddingRight: 14 }) : undefined}
            onClick={onCta}
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
