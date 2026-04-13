import { useEffect, useMemo, useState } from "react";
import { IA, neonCardStyle } from "./theme";

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
    <section className="futuristic-card p-3 mb-3" style={neonCardStyle()}>
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
          className="btn btn-sm"
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            border: `1px solid ${IA.border}`,
            background: "rgba(0,0,0,0.22)",
            color: IA.neon,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 16px rgba(24,255,154,0.12)`,
          }}
          title="Notifications"
        >
          <i className="fas fa-bell" />
        </button>
      </div>
    </section>
  );
}
