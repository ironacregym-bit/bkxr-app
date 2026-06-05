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
  dateKey?: string; // YYYY-MM-DD, defaults to today if not provided
};

const BASE_CLASS = "futuristic-card ia-tile ia-tile-pad mb-2 ia-task-card";

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

function buildCardClassName(highlight?: boolean, muted?: boolean, variant?: Variant): string {
  const classes = [BASE_CLASS];

  if (highlight) {
    classes.push("ia-task-card--highlight");
  }

  if (muted) {
    classes.push("ia-task-card--muted");
  }

  if (variant === "classic") {
    classes.push("ia-task-card--classic");
  } else {
    classes.push("ia-task-card--neon");
  }

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
    () => buildCardClassName(highlight, muted, variant),
    [highlight, muted, variant]
  );

  if (!visible) {
    return null;
  }

  return (
    <section className={className} data-variant={variant}>
      <div className="ia-task-card__row">
        <div className="ia-task-card__content">
          <div className="ia-task-card__title">{title}</div>
          <div className="ia-task-card__subtitle">{subtitle}</div>
        </div>

        <div className="ia-task-card__actions">
          {rightMeta ? <div className="ia-task-card__meta">{rightMeta}</div> : null}

          <button type="button" className="btn btn-sm ia-btn-primary ia-task-card__button" onClick={onCta}>
            {ctaLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
