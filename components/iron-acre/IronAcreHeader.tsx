import { useMemo } from "react";

const ACCENT_IRON = "#22c55e";

function greetingForHour(h: number) {
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function IronAcreHeader({ userName, dateLabel }: { userName: string; dateLabel: string }) {
  const now = useMemo(() => new Date(), []);
  const greet = useMemo(() => greetingForHour(now.getHours()), [now]);

  return (
    <section className="futuristic-card p-3 mb-3">
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div style={{ minWidth: 0 }}>
          <div className="text-dim small">{dateLabel}</div>
          <div className="fw-bold" style={{ fontSize: "1.3rem", lineHeight: 1.2 }}>
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
``
