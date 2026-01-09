
// components/NotificationsBanner.tsx
"use client";

import useSWR from "swr";
import Link from "next/link";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const GRADIENT = "linear-gradient(135deg, #ff7f32, #ff9a3a)";
// In Next.js, assets inside /public are served from root path
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

  if (error) return null;

  if (isLoading)
    return (
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
            overflow: "hidden",
            border: "2px solid rgba(255,255,255,0.4)",
            marginRight: 12,
            flexShrink: 0,
            background: "rgba(255,255,255,0.25)",
          }}
          aria-hidden="true"
        />
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <div
            style={{
              height: 12,
              borderRadius: 6,
              background: "rgba(255,255,255,0.35)",
              marginBottom: 6,
              width: "40%",
            }}
          />
          <div
            style={{
              height: 10,
              borderRadius: 5,
              background: "rgba(255,255,255,0.25)",
              width: "70%",
            }}
          />
        </div>
        <i className="fas fa-chevron-right" aria-hidden="true" style={{ marginLeft: 12, color: "#fff" }} />
      </div>
    );

  const items: FeedItem[] = Array.isArray(data?.items) ? data.items : [];
  if (!items.length) return null;

  return (
    <div className="mb-3" role="region" aria-label="Coach notifications">
      {items.map((n) => (
        <Pill key={n.id} title={n.title} message={n.message} href={n.href} />
      ))}
    </div>
  );
}

function Pill({ title, message, href }: { title: string; message: string; href?: string | null }) {
  const content = (
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
        marginBottom: 12,
      }}
    >
      {/* Coach avatar */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid rgba(255,255,255,0.4)",
          marginRight: 12,
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        <img src={COACH_AVATAR_SRC} alt="Coach" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      {/* Notification body */}
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 16,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 13, opacity: 0.95 }}>{message}</div>
      </div>

      {/* Chevron */}
      <i className="fas fa-chevron-right" aria-hidden="true" style={{ marginLeft: 12, color: "#fff" }} />
    </div>
  );

  return href ? (
    <Link href={href} className="text-decoration-none" aria-label={`${title}: ${message}`} style={{ color: "inherit" }}>
      {content}
    </Link>
  ) : (
    content
  );
}
