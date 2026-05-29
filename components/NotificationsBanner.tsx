// File: components/NotificationsBanner.tsx
"use client";

import Link from "next/link";
import useSWR from "swr";

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
  const { data, error, isLoading } = useSWR("/api/notifications/feed?limit=3", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const items: FeedItem[] = Array.isArray(data?.items) ? data.items : [];

  if (error) {
    return null;
  }

  return (
    <section className="futuristic-card p-3 mb-3" aria-label="Notifications">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div>
          <div style={{ fontSize: 12, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Updates
          </div>
          <h2 className="m-0" style={{ fontSize: "1.05rem" }}>
            Notifications
          </h2>
        </div>
        {!!items.length && (
          <div
            style={{
              minWidth: 28,
              height: 28,
              padding: "0 10px",
              borderRadius: 999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              fontSize: 12,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            {items.length}
          </div>
        )}
      </div>

      {isLoading ? (
        <div
          style={{
            display: "grid",
            gap: 10,
          }}
        >
          {[0, 1].map((i) => (
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
                  width: "40%",
                  height: 12,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.10)",
                  marginBottom: 8,
                }}
              />
              <div
                style={{
                  width: "80%",
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
                  background: item.read_at ? "rgba(255,255,255,0.03)" : "rgba(255,127,50,0.12)",
                  border: item.read_at
                    ? "1px solid rgba(255,255,255,0.08)"
                    : "1px solid rgba(255,127,50,0.35)",
                  transition: "all 0.2s ease",
                }}
              >
                <div className="d-flex align-items-start justify-content-between gap-2">
                  <div className="d-flex align-items-start gap-2" style={{ minWidth: 0 }}>
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        marginTop: 6,
                        flex: "0 0 auto",
                        background: item.read_at ? "rgba(255,255,255,0.25)" : "#ff7f32",
                        boxShadow: item.read_at ? "none" : "0 0 0 4px rgba(255,127,50,0.14)",
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
                  style={{ textDecoration: "none", color: "inherit" }}
                  aria-label={`${item.title}. ${item.message}`}
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
          No new notifications yet.
        </div>
      )}
    </section>
  );
}
