// components/iron-acre/IronAcreHeader.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

type IronAcreHeaderProps = {
  userName: string;
  dateLabel: string;
  notificationsContent?: React.ReactNode;
};

type DropdownPosition = {
  top: number;
  right: number;
  width: number;
};

type NotificationsFeedResp = {
  items?: Array<{
    id: string;
    read_at?: string | null;
    dismissed_at?: string | null;
  }>;
};

const TIME_UPDATE_MS = 30_000;
const DROPDOWN_MAX_WIDTH = 420;
const fetcher = (u: string) => fetch(u).then((r) => r.json());

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

  const { data: feed } = useSWR<NotificationsFeedResp>("/api/notifications/feed?limit=20", fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 15_000,
  });

  const unreadCount = useMemo(() => {
    const items = Array.isArray(feed?.items) ? feed!.items! : [];
    return items.filter((item) => !item.dismissed_at && !item.read_at).length;
  }, [feed]);

  const bellHasUnread = unreadCount > 0;

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
              width: 46,
              height: 46,
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              border: bellHasUnread
                ? "1px solid rgba(22, 219, 170, 0.34)"
                : notificationsOpen
                ? "1px solid rgba(22, 219, 170, 0.24)"
                : "1px solid rgba(255,255,255,0.10)",
              background: bellHasUnread
                ? "rgba(22, 219, 170, 0.12)"
                : notificationsOpen
                ? "rgba(22, 219, 170, 0.08)"
                : "rgba(255,255,255,0.05)",
              color: bellHasUnread || notificationsOpen ? "#16dbaa" : "#fff",
              boxShadow: bellHasUnread
                ? "0 0 18px rgba(22, 219, 170, 0.18)"
                : notificationsOpen
                ? "0 0 12px rgba(22, 219, 170, 0.12)"
                : "none",
              transition: "all 0.2s ease",
              flex: "0 0 auto",
              position: "relative",
              animation: bellHasUnread && !notificationsOpen ? "iaBellPulse 1.8s ease-in-out infinite" : "none",
            }}
          >
            <i className="fas fa-bell" />

            {unreadCount > 0 ? (
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  minWidth: 20,
                  height: 20,
                  padding: "0 6px",
                  borderRadius: 999,
                  background: "#16dbaa",
                  color: "#062820",
                  fontSize: 11,
                  fontWeight: 800,
                  lineHeight: "20px",
                  textAlign: "center",
                  boxShadow: "0 0 0 2px rgba(10,14,20,0.95), 0 0 12px rgba(22, 219, 170, 0.28)",
                }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
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
          {notificationsContent || <div className="text-dim small">No notifications available.</div>}
        </div>
      ) : null}

      <style jsx>{`
        @keyframes iaBellPulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(22, 219, 170, 0);
          }
          50% {
            transform: scale(1.04);
            box-shadow: 0 0 22px rgba(22, 219, 170, 0.22);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(22, 219, 170, 0);
          }
        }
      `}</style>
    </>
  );
}
