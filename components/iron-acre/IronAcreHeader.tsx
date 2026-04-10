import { useEffect, useMemo, useState } from "react";

const ACCENT_IRON = "#22c55e";

function greetingForHour(h: number) {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function IronAcreHeader({ userName, dateLabel }: { userName: string; dateLabel: string }) {
  const [timeText, setTimeText] = useState("");

  const greet = useMemo(() => {
    const h = new Date().getHours();
    return greetingForHour(h);
  }, []);

  useEffect(() => {
    const update = () => {
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      setTimeText(`${hh}:${mm}`);
    };
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="futuristic-card p-3 mb-3">
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div style={{ minWidth: 0 }}>
          <div className="d-flex align-items-center gap-2 text-dim small">
            <span>{timeText}</span>
            <span>•</span>
            <span>{dateLabel}</span>
          </div>
          <div className="fw-bold" style={{ fontSize: "1.35rem", lineHeight: 1.2 }}>
            {greet}, {userName}
          </div>
          <div className="text-dim small mt-1">Iron Acre performance dashboard</div>
        </div>

        <button
          type="button"
          className="btn btn-sm btn-outline-light"
          style={{
            borderRadius: 999,
            borderColor: `${ACCENT_IRON}88`,
            color: ACCENT_IRON,
            background: "transparent",
            whiteSpace: "nowrap",
          }}
          title="Notifications"
        >
          <i className="fas fa-bell" />
        </button>
      </div>
    </section>
  );
}
