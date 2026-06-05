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
const FEED_KEY = "/api/notifications/feed?limit=20";

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
    top: 70,
    right: 10,
    width: DROPDOWN_MAX_WIDTH,
  });

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);

  const { data: feed, mutate } = useSWR<NotificationsFeedResp>(FEED_KEY, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 10_000,
  });

  const unreadCount = useMemo(() => {
    const items = Array.isArray(feed?.items) ? feed.items : [];
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
    const onNotificationsChanged = () => {
      void mutate();
    };

    window.addEventListener("notifications:changed", onNotificationsChanged as EventListener);
    return () => {
      window.removeEventListener("notifications:changed", onNotificationsChanged as EventListener);
    };
  }, [mutate]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const width = Math.min(DROPDOWN_MAX_WIDTH, viewportWidth - 20);
      const right = rect ? Math.max(10, viewportWidth - rect.right) : 10;
      const top = rect ? rect.bottom + 8 : 70;

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
        <div className="d-flex justify-content-between align-items-start gap-2">
          <div style={{ minWidth: 0, flex: "1 1 auto" }}>
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
            ref={buttonRef}
            type="button"
            className="ia-header-bell"
            title="Notifications"
            aria-label="Open notifications"
            aria-expanded={notificationsOpen}
            aria-haspopup="dialog"
            onClick={() => setNotificationsOpen((prev) => !prev)}
            data-active={notificationsOpen ? "true" : "false"}
            data-unread={bellHasUnread ? "true" : "false"}
          >
            <i className="fas fa-bell" />

            {unreadCount > 0 ? (
              <span className="ia-header-bell-count">
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
          className="ia-header-notifications-dropdown ia-tile"
          style={{
            top: dropdownPos.top,
            right: dropdownPos.right,
            width: dropdownPos.width,
          }}
        >
          {notificationsContent || <div className="text-dim small">No notifications available.</div>}
        </div>
      ) : null}
    </>
  );
}
