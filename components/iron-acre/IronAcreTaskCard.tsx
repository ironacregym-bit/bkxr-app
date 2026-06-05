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

const BASE_CLASS = "ia-task-card";

function getDayIndexFromDateKey(dateKey?: string): number {
  if (dateKey) {
    const date = new Date(`${dateKey}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return date.getDay();
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

function buildClassName({
  muted,
  highlight,
  variant,
}: {
  muted?: boolean;
  highlight?: boolean;
  variant: Variant;
}): string {
  const classes = [BASE_CLASS];

  if (muted) {
    classes.push("ia-task-card--muted");
  }

  if (highlight) {
    classes.push("ia-task-card--highlight");
  }

  classes.push(variant === "classic" ? "ia-task-card--classic" : "ia-task-card--neon");

  return classes.join(" ");
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
  const visible = useMemo(() => shouldRender(schedule, dateKey), [schedule, dateKey]);
  const className = useMemo(
    () =>
      buildClassName({
        muted,
        highlight,
        variant,
      }),
    [muted, highlight, variant]
  );

  if (!visible) {
    return null;
  }

  return (
    <section className={className} data-variant={variant}>
      <div className="ia-task-card__main">
        <div className="ia-task-card__titleRow">
          <h3 className="ia-task-card__title">{title}</h3>
          {rightMeta ? <span className="ia-task-card__meta">{rightMeta}</span> : null}
        </div>

        <p className="ia-task-card__subtitle">{subtitle}</p>
      </div>

      <div className="ia-task-card__aside">
        <button
          type="button"
          className="btn btn-sm ia-btn-primary ia-task-card__button"
          onClick={onCta}
        >
          {ctaLabel}
        </button>
      </div>
    </section>
  );
}
