// components/iron-acre/IronAcreHeader.tsx
"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
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
const PROFILE_DROPDOWN_WIDTH = 260;
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

function getInitials(name: string): string {
  const cleaned = String(name || "").trim();

  if (!cleaned) return "IA";

  const parts = cleaned
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  return cleaned.slice(0, 2).toUpperCase();
}

export default function IronAcreHeader({
  userName,
  dateLabel,
  notificationsContent,
}: IronAcreHeaderProps) {
  const [timeText, setTimeText] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const [dropdownPos, setDropdownPos] = useState<DropdownPosition>({
    top: 78,
    right: 12,
    width: DROPDOWN_MAX_WIDTH,
  });

  const [profileDropdownPos, setProfileDropdownPos] = useState<DropdownPosition>({
    top: 78,
    right: 12,
    width: PROFILE_DROPDOWN_WIDTH,
  });

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const profileButtonRef = useRef<HTMLButtonElement | null>(null);
  const profileDropdownRef = useRef<HTMLDivElement | null>(null);

  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);
  const initials = useMemo(() => getInitials(userName), [userName]);

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
    if (!profileOpen) return;

    const updatePosition = () => {
      const rect = profileButtonRef.current?.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const width = Math.min(PROFILE_DROPDOWN_WIDTH, viewportWidth - 24);
      const right = rect ? Math.max(12, viewportWidth - rect.right) : 12;
      const top = rect ? rect.bottom + 10 : 78;

      setProfileDropdownPos({ top, right, width });
    };

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [profileOpen]);

  useEffect(() => {
    if (!notificationsOpen && !profileOpen) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const clickedNotificationButton = buttonRef.current?.contains(target);
      const clickedNotificationDropdown = dropdownRef.current?.contains(target);

      const clickedProfileButton = profileButtonRef.current?.contains(target);
      const clickedProfileDropdown = profileDropdownRef.current?.contains(target);

      if (!clickedNotificationButton && !clickedNotificationDropdown) {
        setNotificationsOpen(false);
      }

      if (!clickedProfileButton && !clickedProfileDropdown) {
        setProfileOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [notificationsOpen, profileOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [notificationsOpen]);

  async function handleSignOut() {
    await signOut({ callbackUrl: "/register" });
  }

  const notificationSheetStyle = {
    "--ia-notification-sheet-top": `${dropdownPos.top}px`,
    "--ia-notification-sheet-right": `${dropdownPos.right}px`,
    "--ia-notification-sheet-width": `${dropdownPos.width}px`,
  } as CSSProperties;

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

          <div className="d-flex align-items-center gap-2" style={{ flex: "0 0 auto" }}>
            <button
              ref={buttonRef}
              type="button"
              className="btn"
              title="Notifications"
              aria-label="Open notifications"
              aria-expanded={notificationsOpen}
              aria-haspopup="dialog"
              onClick={() => {
                setProfileOpen(false);
                setNotificationsOpen((prev) => !prev);
              }}
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
                position: "relative",
                animation:
                  bellHasUnread && !notificationsOpen
                    ? "iaBellPulse 1.8s ease-in-out infinite"
                    : "none",
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
                    boxShadow:
                      "0 0 0 2px rgba(10,14,20,0.95), 0 0 12px rgba(22, 219, 170, 0.28)",
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>

            <button
              ref={profileButtonRef}
              type="button"
              className="btn"
              title="Profile"
              aria-label="Open profile menu"
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              onClick={() => {
                setNotificationsOpen(false);
                setProfileOpen((prev) => !prev);
              }}
              style={{
                width: 46,
                height: 46,
                padding: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                border: profileOpen
                  ? "1px solid rgba(22, 219, 170, 0.28)"
                  : "1px solid rgba(255,255,255,0.10)",
                background: profileOpen ? "rgba(22, 219, 170, 0.08)" : "rgba(255,255,255,0.05)",
                color: profileOpen ? "#16dbaa" : "#fff",
                boxShadow: profileOpen ? "0 0 12px rgba(22, 219, 170, 0.12)" : "none",
                transition: "all 0.2s ease",
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: "0.04em",
              }}
            >
              {initials}
            </button>
          </div>
        </div>
      </section>

      {notificationsOpen ? (
        <>
          <div
            className="ia-notification-sheet-backdrop"
            aria-hidden="true"
            onClick={() => setNotificationsOpen(false)}
          />

          <div
            ref={dropdownRef}
            role="dialog"
            aria-label="Notifications"
            className="ia-notification-sheet"
            style={notificationSheetStyle}
          >
            <div className="ia-sheet-handle" />

            {notificationsContent || (
              <div className="text-dim small">No notifications available.</div>
            )}
          </div>
        </>
      ) : null}

      {profileOpen ? (
        <div
          ref={profileDropdownRef}
          role="menu"
          aria-label="Profile menu"
          className="ia-tile"
          style={{
            position: "fixed",
            top: profileDropdownPos.top,
            right: profileDropdownPos.right,
            width: profileDropdownPos.width,
            zIndex: 1050,
            padding: 14,
            borderRadius: 22,
            background:
              "linear-gradient(180deg, rgba(14,18,24,0.98) 0%, rgba(10,14,20,0.98) 100%)",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 18px 48px rgba(0,0,0,0.45)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
          }}
        >
          <div
            style={{
              padding: "4px 4px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              marginBottom: 10,
            }}
          >
            <div style={{ color: "#fff", fontWeight: 800, lineHeight: 1.2 }}>{userName}</div>
            <div className="text-dim small mt-1">Iron Acre account</div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <Link
              href="/profile => setProfileOpen(false)}"
              role="menuitem"
              style={{ display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 10px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              <i className="fas fa-user" style={{ color: "#16dbaa", width: 16 }} />
              Profile
            </Link>
          
            <Link href="/onboarding?returnTo=%2F => setProfileOpen(false)}"
              style={{
                color: "#fff",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 10px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              <i className="fas fa-rotate-right" style={{ color: "#16dbaa", width: 16 }} />
              Redo onboarding
            </Link>
          
            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              style={{
                color: "rgba(255,255,255,0.86)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 10px",
                borderRadius: 14,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                fontSize: 14,
                fontWeight: 700,
                textAlign: "left",
                width: "100%",
              }}
            >
              <i
                className="fas fa-right-from-bracket"
                style={{ color: "#ffb3b3", width: 16 }}
              />
              Sign out
            </button>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .ia-notification-sheet-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1049;
          background: rgba(0, 0, 0, 0.56);
          backdrop-filter: blur(7px);
          -webkit-backdrop-filter: blur(7px);
        }

        .ia-notification-sheet {
          position: fixed;
          z-index: 1050;
          color: #fff;
          background: linear-gradient(
            180deg,
            rgba(14, 18, 24, 0.98) 0%,
            rgba(10, 14, 20, 0.98) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          overflow-y: auto;
          overscroll-behavior: contain;
        }

        .ia-sheet-handle {
          width: 42px;
          height: 5px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.22);
          margin: 0 auto 14px;
        }

        @media (max-width: 767px) {
          .ia-notification-sheet {
            left: 0;
            right: 0;
            bottom: 0;
            top: auto;
            width: 100%;
            height: min(82dvh, 720px);
            max-height: calc(100dvh - 72px);
            padding: 16px 14px calc(18px + env(safe-area-inset-bottom, 0px));
            border-radius: 24px 24px 0 0;
            border-bottom: none;
            box-shadow: 0 -18px 48px rgba(0, 0, 0, 0.5);
            animation: iaSheetUp 0.24s ease-out;
          }
        }

        @media (min-width: 768px) {
          .ia-notification-sheet {
            top: var(--ia-notification-sheet-top);
            right: var(--ia-notification-sheet-right);
            width: var(--ia-notification-sheet-width);
            max-height: min(70vh, 640px);
            padding: 16px;
            border-radius: 22px;
          }

          .ia-sheet-handle {
            display: none;
          }
        }

        @keyframes iaSheetUp {
          from {
            opacity: 0.92;
            transform: translateY(100%);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

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
