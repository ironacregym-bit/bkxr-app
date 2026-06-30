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

  const { supported, subscribed, permission, busy, error: pushError } = usePushNotifications();

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
      if (!res.ok) throw new Error(String(json?.error || "Failed to clear notifications"));

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
      if (!res.ok) throw new Error(String(json?.error || "Failed to dismiss notification"));

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
    <div>
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
        <div>
          <div
            className="text-dim small"
            style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
          >
            Updates
          </div>

          <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>
            Notifications
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          {unreadCount > 0 ? (
            <span
              className="ia-badge"
              style={{
                background: "rgba(22, 219, 170, 0.12)",
                border: "1px solid rgba(22, 219, 170, 0.28)",
                color: "#d9fff5",
                minWidth: 30,
                justifyContent: "center",
              }}
            >
              {unreadCount}
            </span>
          ) : null}

          {supported ? (
            subscribed ? (
              <div
                className="ia-badge"
                style={{
                  background: "rgba(22, 219, 170, 0.12)",
                  border: "1px solid rgba(22, 219, 170, 0.28)",
                  color: "#d9fff5",
                  boxShadow: "0 0 0 1px rgba(255,255,255,0.02) inset",
                }}
              >
                Push enabled
              </div>
            ) : (
              <div
                className="ia-badge"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "rgba(255,255,255,0.82)",
                }}
              >
                Push off
              </div>
            )
          ) : (
            <div
              className="ia-badge"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "rgba(255,255,255,0.60)",
              }}
            >
              Unsupported
            </div>
          )}
        </div>
      </div>

      {items.length > 0 ? (
        <div className="d-flex justify-content-end mb-3">
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
        <div
          className="mb-3"
          style={{
            borderRadius: 18,
            padding: 14,
            background: "rgba(22, 219, 170, 0.08)",
            border: "1px solid rgba(22, 219, 170, 0.18)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.03)",
          }}
        >
          <div style={{ fontWeight: 700, color: "#fff", marginBottom: 6 }}>
            Turn on push notifications
          </div>

          <div
            style={{
              color: "rgba(255,255,255,0.78)",
              fontSize: 14,
              lineHeight: 1.45,
              marginBottom: 12,
            }}
          >
            Get workout reminders, class updates and important gym alerts straight to your device.
          </div>

          {permission === "denied" ? (
            <div
              style={{
                color: "#ffb3b3",
                fontSize: 13,
                lineHeight: 1.45,
                marginBottom: 10,
              }}
            >
              Notifications are currently blocked in your browser settings.
            </div>
          ) : null}

          {!!pushError ? (
            <div
              style={{
                color: "#ffb3b3",
                fontSize: 13,
                lineHeight: 1.45,
                marginBottom: 10,
              }}
            >
              {pushError}
            </div>
          ) : null}

          <PushSubscribeButton
            className="ia-btn ia-btn-primary"
            style={{
              borderRadius: 999,
              whiteSpace: "nowrap",
              minHeight: 40,
              width: "100%",
              justifyContent: "center",
            }}
          >
            {busy ? "Enabling..." : "Enable push notifications"}
          </PushSubscribeButton>
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            borderRadius: 16,
            padding: 14,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.72)",
            fontSize: 14,
          }}
        >
          Unable to load notifications right now.
        </div>
      ) : isLoading ? (
        <div style={{ display: "grid", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                borderRadius: 16,
                padding: "12px 14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div
                style={{
                  width: "38%",
                  height: 12,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.12)",
                  marginBottom: 8,
                }}
              />

              <div
                style={{
                  width: "78%",
                  height: 10,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                }}
              />
            </div>
          ))}
        </div>
      ) : items.length ? (
        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item) => {
            const unread = !item.read_at;

            const content = (
              <div
                style={{
                  borderRadius: 16,
                  padding: "12px 14px",
                  background: unread
                    ? "linear-gradient(180deg, rgba(14, 44, 36, 0.82) 0%, rgba(10, 28, 24, 0.88) 100%)"
                    : "rgba(255,255,255,0.03)",
                  border: unread
                    ? "1px solid rgba(22, 219, 170, 0.24)"
                    : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: unread
                    ? "0 0 0 1px rgba(255,255,255,0.02) inset, 0 8px 22px rgba(0,0,0,0.18)"
                    : "none",
                  transition: "all 0.2s ease",
                  position: "relative",
                }}
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
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 24,
                    height: 24,
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.78)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  {workingId === item.id ? "…" : "×"}
                </button>

                <div
                  className="d-flex align-items-start justify-content-between gap-2"
                  style={{ paddingRight: 30 }}
                >
                  <div className="d-flex align-items-start gap-2" style={{ minWidth: 0 }}>
                    <div
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        marginTop: 6,
                        flex: "0 0 auto",
                        background: unread ? "#16dbaa" : "rgba(255,255,255,0.25)",
                        boxShadow: unread ? "0 0 0 4px rgba(22, 219, 170, 0.12)" : "none",
                      }}
                    />

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 15,
                          lineHeight: 1.25,
                          color: "#fff",
                          marginBottom: 4,
                        }}
                      >
                        {item.title}
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          lineHeight: 1.45,
                          color: unread ? "rgba(235,255,249,0.88)" : "rgba(255,255,255,0.82)",
                        }}
                      >
                        {item.message}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: unread ? "rgba(195, 255, 240, 0.62)" : "rgba(255,255,255,0.55)",
                      whiteSpace: "nowrap",
                      flex: "0 0 auto",
                    }}
                  >
                    {formatCreatedAt(item.created_at)}
                  </div>
                </div>
              </div>
            );

            if (isInternalHref(item.href)) {
              return (
                {item.href
                  {content}
                </Link>
              );
            }

            if (item.href) {
              return (
                {item.href}
                  {content}
                </a>
              );
            }

            return <div key={item.id}>{content}</div>;
          })}
        </div>
      ) : (
        <div
          style={{
            borderRadius: 16,
            padding: 14,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.72)",
            fontSize: 14,
            lineHeight: 1.45,
          }}
        >
          No notifications yet.
        </div>
      )}
    </div>
  );
}
