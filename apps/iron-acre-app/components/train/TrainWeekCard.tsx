// components/train/TrainWeekCard.tsx
import Link from "next/link";

type TrainWeekCardProps = {
  href: string;
  dayLabel: string;
  title: string;
  extraCount: number;
  done: boolean;
  isToday?: boolean;
};

export default function TrainWeekCard({
  href,
  dayLabel,
  title,
  extraCount,
  done,
  isToday = false,
}: TrainWeekCardProps) {
  const statusLabel = done ? "Done" : isToday ? "Today" : "Open";

  return (
    <Link href={href} className="ia-link-no-underline">
      <div
        className={[
          "ia-train-week-card",
          done ? "ia-train-week-card-done" : "",
          isToday ? "ia-train-week-card-today" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="ia-train-week-card-top">
          <span
            className={[
              "ia-train-week-day-pill",
              isToday ? "ia-train-week-day-pill-today" : "",
              done ? "ia-train-week-day-pill-done" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {dayLabel}
          </span>

          <span
            className={[
              "ia-train-week-status",
              done ? "ia-train-week-status-done" : "",
              !done ? "ia-train-week-status-open" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {statusLabel}
          </span>
        </div>

        <div className="ia-train-week-title">{title}</div>

        <div className="ia-train-week-meta">
          {extraCount > 0 ? `+${extraCount} more` : "Scheduled"}
        </div>

        <div className="ia-train-week-accent" />
      </div>
    </Link>
  );
}
