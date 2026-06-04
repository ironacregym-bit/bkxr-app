// components/iron-acre/IronAcreHeader.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type IronAcreHeaderProps = {
  userName: string;
  dateLabel: string;
  notificationsContent?: React.ReactNode;
};

const TIME_UPDATE_MS = 30_000;
const DROPDOWN_MAX_WIDTH = 420;

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

type DropdownPosition = {
  top: number;
  right: number;
  width: number;
};

export default function IronAcreHeader({
  userName,
  dateLabel,
  notificationsContent,
}: IronAcreHeaderProps) {
  const [timeText, setTimeText] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition>({
    top: 78,
    right: 12,
    width: DROPDOWN_MAX_WIDTH,
  });

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);

  useEffect(() => {
    const tick = () => setTimeText(formatHHMM(new Date()));
    tick();

    const timer = window.setInterval(tick, TIME_UPDATE_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notificationsOpen) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const width = Math.min(DROPDOWN_MAX_WIDTH, viewportWidth - 24);
      const right = rect ? Math.max(12, viewportWidth - rect.right) : 12;
      const top = rect ? rect.bottom + 10 : 78;

      setDropdownPos({ top, right, width });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const clickedButton = buttonRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);

      if (!clickedButton && !clickedDropdown) {
        setNotificationsOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [notificationsOpen]);

  return (
    <>
      <section className="ia-tile ia-tile-pad mb-3">
        <div className="d-flex justify-content-between align-items-start gap-3">
          <div style={{ minWidth: 0 }}>
            <div
              className="text-dim small"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                letterSpacing: "0.04em",
              }}
            >
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
            ref={buttonRef}
            type="button"
            className="btn"
            title="Notifications"
            aria-label="Open notifications"
            aria-expanded={notificationsOpen}
            aria-haspopup="dialog"
            onClick={() => setNotificationsOpen((prev) => !prev)}
            style={{
              width: 44,
              height: 44,
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              border: notificationsOpen
                ? "1px solid rgba(255,127,50,0.30)"
                : "1px solid rgba(255,255,255,0.10)",
              background: notificationsOpen
                ? "rgba(255,127,50,0.12)"
                : "rgba(255,255,255,0.05)",
              color: notificationsOpen ? "#ff7f32" : "#fff",
              boxShadow: notificationsOpen ? "0 0 14px rgba(255,127,50,0.18)" : "none",
              transition: "all 0.2s ease",
              flex: "0 0 auto",
            }}
          >
            <i className="fas fa-bell" />
          </button>
        </div>
      </section>

      {notificationsOpen ? (
        <div
          ref={dropdownRef}
          role="dialog"
          aria-label="Notifications"
          className="ia-tile"
          style={{
            position: "fixed",
            top: dropdownPos.top,
            right: dropdownPos.right,
            width: dropdownPos.width,
            maxHeight: "min(70vh, 640px)",
            overflowY: "auto",
            zIndex: 1050,
            padding: 16,
            borderRadius: 22,
            background:
              "linear-gradient(180deg, rgba(14,18,24,0.98) 0%, rgba(10,14,20,0.98) 100%)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
          }}
        >
          {notificationsContent || (
            <div className="text-dim small">No notifications available.</div>
          )}
        </div>
      ) : null}
    </>
  );
}
