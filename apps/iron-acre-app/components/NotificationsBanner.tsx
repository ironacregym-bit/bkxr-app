// components/NotificationsBanner.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import PushSubscribeButton, { usePushNotifications } from "./PushSubscribeButton";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type FeedItem = {
  id: string;
  title: string;
  message: string;
  href?: string | null;
  read_at?: string | null;
  created_at?: string | null;
  dismissed_at?: string | null;
};

type FeedResp = {
  items?: FeedItem[];
};

function formatCreatedAt(value?: string | null) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

function notifyNotificationsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("notifications:changed"));
}

function isInternalHref(href?: string | null) {
  const value = String(href || "").trim();
  return value.startsWith("/") && !value.startsWith("//");
}

export default function NotificationsBanner() {
  const { data, error, isLoading, mutate } = useSWR<FeedResp>(
    "/api/notifications/feed?limit=8",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  );

  const items = useMemo(() => {
    const raw = Array.isArray(data?.items) ? data.items : [];
    return raw.filter((item) => !item.dismissed_at);
  }, [data]);

  const unreadCount = useMemo(() => {
    return items.filter((item) => !item.read_at).length;
  }, [items]);

  const { supported, subscribed, permission, busy, error: pushError } =
    usePushNotifications();

  const [workingId, setWorkingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const openedOnceRef = useRef(false);

  useEffect(() => {
    if (openedOnceRef.current) return;
    if (!items.length) return;
    if (unreadCount <= 0) return;

    openedOnceRef.current = true;

    void (async () => {
      try {
        await fetch("/api/notifications/mark-all-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        await mutate(
          (current) => {
            const currentItems = Array.isArray(current?.items) ? current.items : [];
            const nowIso = new Date().toISOString();

            return {
              items: currentItems.map((item) =>
                item.read_at
                  ? item
                  : {
                      ...item,
                      read_at: nowIso,
                    }
              ),
            };
          },
          false
        );

        notifyNotificationsChanged();
      } catch {
        // no-op
      }
    })();
  }, [items.length, unreadCount, mutate]);

  async function handleClearAll() {
    if (!items.length) return;

    try {
      setClearingAll(true);

      const res = await fetch("/api/notifications/clear-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(String(json?.error || "Failed to clear notifications"));
      }

      await mutate({ items: [] }, false);
      notifyNotificationsChanged();
    } catch {
      // no-op
    } finally {
      setClearingAll(false);
    }
  }

  async function handleDismiss(id: string) {
    if (!id) return;

    try {
      setWorkingId(id);

      const res = await fetch("/api/notifications/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(String(json?.error || "Failed to dismiss notification"));
      }

      await mutate(
        (current) => {
          const currentItems = Array.isArray(current?.items) ? current.items : [];

          return {
            items: currentItems.filter((item) => item.id !== id),
          };
        },
        false
      );

      notifyNotificationsChanged();
    } catch {
      // no-op
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="ia-notifications">
      <div className="ia-notifications-header">
        <div>
          <div className="ia-notifications-kicker">Updates</div>
          <div className="ia-notifications-title">Notifications</div>
        </div>

        <div className="ia-notifications-header-actions">
          {unreadCount > 0 ? (
            <span className="ia-badge ia-notifications-count">{unreadCount}</span>
          ) : null}

          {supported ? (
            subscribed ? (
              <div className="ia-badge ia-notifications-push ia-notifications-push-enabled">
                Push enabled
              </div>
            ) : (
              <div className="ia-badge ia-notifications-push ia-notifications-push-off">
                Push off
              </div>
            )
          ) : (
            <div className="ia-badge ia-notifications-push ia-notifications-push-unsupported">
              Unsupported
            </div>
          )}
        </div>
      </div>

      {items.length > 0 ? (
        <div className="ia-notifications-clear-row">
          <button
            type="button"
            className="ia-btn ia-btn-outline"
            onClick={handleClearAll}
            disabled={clearingAll}
          >
            {clearingAll ? "Clearing…" : "Clear all"}
          </button>
        </div>
      ) : null}

      {supported && !subscribed ? (
        <div className="ia-notifications-push-card">
          <div className="ia-notifications-push-title">Turn on push notifications</div>

          <div className="ia-notifications-push-copy">
            Get workout reminders, class updates and important gym alerts straight to your device.
          </div>

          {permission === "denied" ? (
            <div className="ia-notifications-error-copy">
              Notifications are currently blocked in your browser settings.
            </div>
          ) : null}

          {!!pushError ? (
            <div className="ia-notifications-error-copy">{pushError}</div>
          ) : null}

          <PushSubscribeButton className="ia-btn ia-btn-primary ia-notifications-push-button">
            {busy ? "Enabling..." : "Enable push notifications"}
          </PushSubscribeButton>
        </div>
      ) : null}

      {error ? (
        <div className="ia-notifications-state">
          Unable to load notifications right now.
        </div>
      ) : isLoading ? (
        <div className="ia-notifications-loading-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="ia-notifications-skeleton-card">
              <div className="ia-notifications-skeleton-title" />
              <div className="ia-notifications-skeleton-line" />
            </div>
          ))}
        </div>
      ) : items.length ? (
        <div className="ia-notifications-list">
          {items.map((item) => {
            const unread = !item.read_at;

            const content = (
              <div
                className={`ia-notification-card ${
                  unread ? "ia-notification-card-unread" : "ia-notification-card-read"
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void handleDismiss(item.id);
                  }}
                  disabled={workingId === item.id}
                  aria-label="Dismiss notification"
                  className="ia-notification-dismiss"
                >
                  {workingId === item.id ? "…" : "×"}
                </button>

                <div className="ia-notification-layout">
                  <div className="ia-notification-main">
                    <div
                      className={`ia-notification-dot ${
                        unread ? "ia-notification-dot-unread" : "ia-notification-dot-read"
                      }`}
                    />

                    <div className="ia-notification-copy">
                      <div className="ia-notification-title">{item.title}</div>
                      <div
                        className={`ia-notification-message ${
                          unread
                            ? "ia-notification-message-unread"
                            : "ia-notification-message-read"
                        }`}
                      >
                        {item.message}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`ia-notification-date ${
                      unread ? "ia-notification-date-unread" : "ia-notification-date-read"
                    }`}
                  >
                    {formatCreatedAt(item.created_at)}
                  </div>
                </div>
              </div>
            );

            if (isInternalHref(item.href)) {
              return (
                <Link
                  key={item.id}
                  href={item.href || "/"}
                  className="ia-notification-link"
                >
                  {content}
                </Link>
              );
            }

            if (item.href) {
              return (
                <a
                  key={item.id}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ia-notification-link"
                >
                  {content}
                </a>
              );
            }

            return <div key={item.id}>{content}</div>;
          })}
        </div>
      ) : (
        <div className="ia-notifications-state">No notifications yet.</div>
      )}
    </div>
  );
}
