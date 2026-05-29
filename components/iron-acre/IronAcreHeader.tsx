// components/iron-acre/IronAcreHeader.tsx
import { useEffect, useMemo, useState } from "react";
import NotificationsBanner from "../NotificationsBanner";

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
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);

  useEffect(() => {
    const tick = () => setTimeText(formatHHMM(new Date()));
    tick();

    const timer = window.setInterval(tick, TIME_UPDATE_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notificationsOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [notificationsOpen]);

  return (
    <>
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
              borderRadius: 999,
            }}
            title="Notifications"
            aria-label="Open notifications"
            aria-expanded={notificationsOpen}
            aria-haspopup="dialog"
            onClick={() => setNotificationsOpen(true)}
          >
            <i className="fas fa-bell" />
          </button>
        </div>
      </section>

      {notificationsOpen && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => setNotificationsOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              border: "none",
              padding: 0,
              margin: 0,
              zIndex: 1040,
              cursor: "default",
            }}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
            style={{
              position: "fixed",
              left: 12,
              right: 12,
              top: 12,
              zIndex: 1050,
              maxWidth: 560,
              margin: "0 auto",
            }}
          >
            <div
              className="futuristic-card ia-tile"
              style={{
                maxHeight: "calc(100vh - 24px)",
                overflowY: "auto",
                padding: 16,
                borderRadius: 22,
              }}
            >
              <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
                <div>
                  <div className="text-dim small" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Iron Acre Gym
                  </div>
                  <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#fff" }}>
                    Notifications
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-sm ia-btn-outline"
                  onClick={() => setNotificationsOpen(false)}
                  style={{
                    width: 38,
                    height: 38,
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 999,
                  }}
                  aria-label="Close notifications"
                >
                  <i className="fas fa-times" />
                </button>
              </div>

              <NotificationsBanner />
            </div>
          </div>
        </>
      )}
    </>
  );
}
