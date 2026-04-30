import React, { useMemo } from "react";

type Variant = "neon" | "classic";

export type IronAcreTaskCardProps = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  onCta: () => void;
  rightMeta?: string;
  muted?: boolean;
  variant?: Variant;
  highlight?: boolean;
};

const BASE_CLASS = "futuristic-card ia-tile ia-tile-pad mb-2";

function buildStyle(highlight?: boolean, muted?: boolean): React.CSSProperties | undefined {
  if (!highlight && !muted) return undefined;

  const style: React.CSSProperties = {};
  if (muted) style.opacity = 0.75;

  // Highlight is a state: subtle accent without “whole card green”
  if (highlight) {
    style.border = "1px solid var(--ia-neon)";
    style.boxShadow = "0 0 0 1px rgba(24,255,154,0.18) inset, 0 0 18px rgba(24,255,154,0.12)";
  }

  return style;
}

export default function IronAcreTaskCard({
  title,
  subtitle,
  ctaLabel,
  onCta,
  rightMeta,
  muted,
  variant = "neon",
  highlight = false,
}: IronAcreTaskCardProps) {
  // Keeping variant for compatibility, but styling is now driven by CSS primitives.
  // If you later want classic/neon differences, we can add CSS modifiers.
  const className = BASE_CLASS;

  const style = useMemo(() => buildStyle(highlight, muted), [highlight, muted]);

  return (
    <section className={className} style={style} data-variant={variant}>
      <div className="d-flex justify-content-between align-items-center gap-2">
        <div style={{ minWidth: 0 }}>
          <div className="ia-tile-title">{title}</div>
          <div className="text-dim small">{subtitle}</div>
        </div>

        <div className="d-flex align-items-center gap-2">
          {rightMeta ? <div className="text-dim small">{rightMeta}</div> : null}

          <button type="button" className="btn btn-sm ia-btn-primary" onClick={onCta}>
            {ctaLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
