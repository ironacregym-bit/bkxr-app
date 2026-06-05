// components/iron-acre/IronAcreTaskCard.tsx
"use client";

import React, { useMemo } from "react";

type Variant = "neon" | "classic";
type Schedule = "always" | "daily" | "friday";

export type IronAcreTaskCardProps = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  onCta: () => void;
  rightMeta?: string;
  muted?: boolean;
  variant?: Variant;
  highlight?: boolean;
  schedule?: Schedule;
  dateKey?: string;
};

const BASE_CLASS = "ia-tile ia-tile-pad mb-2";

function buildStyle(highlight?: boolean, muted?: boolean): React.CSSProperties | undefined {
  if (!highlight && !muted) return undefined;

  const style: React.CSSProperties = {};

  if (muted) {
    style.opacity = 0.75;
  }

  if (highlight) {
    style.border = "1px solid var(--ia-neon)";
    style.boxShadow = "0 0 0 1px rgba(22,219,170,0.18) inset, 0 0 18px rgba(22,219,170,0.12)";
  }

  return style;
}

function getDayIndexFromDateKey(dateKey?: string): number {
  if (dateKey) {
    const d = new Date(`${dateKey}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.getDay();
    }
  }

  return new Date().getDay();
}

function shouldRender(schedule: Schedule, dateKey?: string): boolean {
  if (schedule === "always") return true;
  if (schedule === "daily") return true;
  if (schedule === "friday") return getDayIndexFromDateKey(dateKey) === 5;
  return true;
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
  schedule = "always",
  dateKey,
}: IronAcreTaskCardProps) {
  const className = BASE_CLASS;
  const style = useMemo(() => buildStyle(highlight, muted), [highlight, muted]);
  const visible = useMemo(() => shouldRender(schedule, dateKey), [schedule, dateKey]);

  if (!visible) {
    return null;
  }

  return (
    <section className={className} style={style} data-variant={variant}>
      <div className="d-flex justify-content-between align-items-center gap-2">
        <div style={{ minWidth: 0, flex: "1 1 auto" }}>
          <div className="ia-tile-title">{title}</div>
          <div className="text-dim small">{subtitle}</div>
        </div>

        <div className="d-flex align-items-center gap-2" style={{ flex: "0 0 auto", whiteSpace: "nowrap" }}>
          {rightMeta ? <div className="text-dim small">{rightMeta}</div> : null}

          <button type="button" className="ia-btn ia-btn-primary" onClick={onCta}>
            {ctaLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
