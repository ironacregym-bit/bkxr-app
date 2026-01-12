
"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import Link from "next/link";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const GRADIENT = "linear-gradient(135deg, #ff7f32, #ff9a3a)";
const COACH_AVATAR_SRC = "/coach.jpg";

type FeedItem = {
  id: string;
  title: string;
  message: string;
  href?: string | null;
};

export default function NotificationsBanner() {
  const { data, error, isLoading } = useSWR("/api/notifications/feed?limit=10", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const items: FeedItem[] = Array.isArray(data?.items) ? data.items : [];
  const [notifIndex, setNotifIndex] = useState<number>(0);

  useEffect(() => {
    setNotifIndex((i) => (items.length ? Math.min(i, items.length - 1) : 0));
  }, [items.length]);

  const goPrev = () => setNotifIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
  const goNext = () => setNotifIndex((i) => (i >= items.length - 1 ? 0 : i + 1));

  // ✅ Always render a stable wrapper to avoid hydration mismatch
  return (
    <div role="region" aria-label="Coach notifications" aria-live="polite" className="mb-3">
      {error ? (
        <div style={{ opacity: 0.6, fontSize: "0.85rem", color: "#fff" }}>No notifications</div>
      ) : isLoading ? (
        <div
          className="mb-2"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: GRADIENT,
            borderRadius: 9999,
            padding: "12px 16px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
            color: "#fff",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.25)",
              marginRight: 12,
            }}
          />
          <div style={{ flexGrow: 1 }}>
            <div style={{ height: 12, borderRadius: 6, background: "rgba(255,255,255,0.35)", marginBottom: 6, width: "40%" }} />
            <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.25)", width: "70%" }} />
          </div>
          <i className="fas fa-chevron-right" aria-hidden="true" />
        </div>
      ) : items.length ? (
        <>
          {/* Pill */}
          {(() => {
            const current = items[notifIndex];
            const Pill = (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: GRADIENT,
                  borderRadius: 9999,
                  padding: "12px 16px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
                  color: "#fff",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    overflow: "hidden",
                    border: "2px solid rgba(255,255,255,0.4)",
                    marginRight: 12,
                  }}
                >
                  <img src={COACH_AVATAR_SRC} alt="Coach" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {current.title}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.95 }}>{current.message}</div>
                </div>
                <i className="fas fa-chevron-right" aria-hidden="true" style={{ marginLeft: 12 }} />
              </div>
            );
            return current.href ? (
              <Link href={current.href} className="text-decoration-none" style={{ color: "inherit" }}>
                {Pill}
              </Link>
            ) : (
              Pill
            );
          })()}

          {/* Controls */}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-bxkr-outline" onClick={goPrev} type="button" style={{ borderRadius: 999 }}>
                ←
              </button>
              <button className="btn btn-sm btn-bxkr" onClick={goNext} type="button" style={{ borderRadius: 999, background: GRADIENT }}>
                →
              </button>
            </div>
            <div className="bxkr-carousel-dots">
              {items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`bxkr-carousel-dot ${notifIndex === i ? "active" : ""}`}
                  onClick={() => setNotifIndex(i)}
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div style={{ opacity: 0.6, fontSize: "0.85rem", color: "#fff" }}>No notifications</div>
      )}
    </div>
  );
}
