// components/NotificationsBanner.tsx
"use client";

import Link from "next/link";
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

export default function NotificationsBanner() {
  const { data, error, isLoading } = useSWR("/api/notifications/feed?limit=8", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const items: FeedItem[] = Array.isArray(data?.items) ? data.items : [];
  const { supported, subscribed, permission, busy, error: pushError } = usePushNotifications();

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
        <div>
          <div className="text-dim small" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Updates
          </div>
          <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>Notifications</div>
        </div>

        {supported ? (
          subscribed ? (
            <div
              style={{
                borderRadius: 999,
                padding: "6px 10px",
                background: "rgba(36, 255, 176, 0.10)",
                border: "1px solid rgba(36, 255, 176, 0.30)",
                color: "#d8fff1",
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              Push enabled
            </div>
          ) : (
            <div
              style={{
                borderRadius: 999,
                padding: "6px 10px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "rgba(255,255,255,0.82)",
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              Push off
            </div>
          )
        ) : (
          <div
            style={{
              borderRadius: 999,
              padding: "6px 10px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.60)",
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            Unsupported
          </div>
        )}
      </div>

      {supported && !subscribed && (
        <div
          style={{
            borderRadius: 18,
            padding: 14,
            marginBottom: 14,
            background: "rgba(255,127,50,0.08)",
            border: "1px solid rgba(255,127,50,0.22)",
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
            Get workout reminders, important gym updates and anything time-sensitive straight to your device.
          </div>

          {permission === "denied" && (
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
          )}

          {!!pushError && (
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
          )}

          <PushSubscribeButton
            className="btn btn-sm ia-btn"
            style={{
              borderRadius: 999,
              whiteSpace: "nowrap",
              minHeight: 40,
            }}
          >
            {busy ? "Enabling..." : "Enable push notifications"}
          </PushSubscribeButton>
        </div>
      )}

      {error ? (
        <div
          style={{
            borderRadius: 16,
            padding: "14px",
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
            const content = (
              <div
                style={{
                  borderRadius: 16,
                  padding: "12px 14px",
                  background: item.read_at ? "rgba(255,255,255,0.03)" : "rgba(255,127,50,0.10)",
                  border: item.read_at
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid rgba(255,127,50,0.24)",
                }}
              >
                <div className="d-flex align-items-start justify-content-between gap-2">
                  <div className="d-flex align-items-start gap-2" style={{ minWidth: 0 }}>
                    <div
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        marginTop: 6,
                        flex: "0 0 auto",
                        background: item.read_at ? "rgba(255,255,255,0.25)" : "#ff7f32",
                        boxShadow: item.read_at ? "none" : "0 0 0 4px rgba(255,127,50,0.12)",
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
                          color: "rgba(255,255,255,0.82)",
                        }}
                      >
                        {item.message}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.55)",
                      whiteSpace: "nowrap",
                      flex: "0 0 auto",
                    }}
                  >
                    {formatCreatedAt(item.created_at)}
                  </div>
                </div>
              </div>
            );

            if (item.href) {
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="text-decoration-none"
                  style={{ color: "inherit" }}
                >
                  {content}
                </Link>
              );
            }

            return <div key={item.id}>{content}</div>;
          })}
        </div>
      ) : (
        <div
          style={{
            borderRadius: 16,
            padding: "14px",
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
