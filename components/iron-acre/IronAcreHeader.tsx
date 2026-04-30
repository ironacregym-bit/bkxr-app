import { useEffect, useMemo, useState } from "react";

type IronAcreHeaderProps = {
  userName: string;
  dateLabel: string;
};

const TIME_UPDATE_MS = 30_000;

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatHHMM(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function IronAcreHeader({ userName, dateLabel }: IronAcreHeaderProps) {
  const [timeText, setTimeText] = useState<string>("");

  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);

  useEffect(() => {
    const tick = () => setTimeText(formatHHMM(new Date()));
    tick();

    const timer = window.setInterval(tick, TIME_UPDATE_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="futuristic-card ia-tile ia-tile-pad mb-3">
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div style={{ minWidth: 0 }}>
          <div className="d-flex align-items-center gap-2 text-dim small">
            <span>{timeText}</span>
            <span>•</span>
            <span>{dateLabel}</span>
          </div>

          <div className="ia-page-title">
            {greeting}, {userName}
          </div>

          <div className="ia-page-subtitle">Iron Acre performance dashboard</div>
        </div>

        <button
          type="button"
          className="btn btn-sm ia-btn-outline"
          style={{
            width: 40,
            height: 40,
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Notifications"
          aria-label="Notifications"
        >
          <i className="fas fa-bell" />
        </button>
      </div>
    </section>
  );
}
