
// components/NotificationsBanner.tsx
"use client";

import useSWR from "swr";
import Link from "next/link";

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const GRADIENT = "linear-gradient(135deg, #ff7f32, #ff9a3a)";
const COACH_AVATAR_SRC = "/coach.jpg"; // replace with your asset

export default function NotificationsBanner() {
  const { data, error, isLoading } = useSWR("/api/notifications/feed?limit=10", fetcher, {
    revalidateOnFocus: false, dedupingInterval: 30_000,
  });

  if (error) return null;
  if (isLoading) return <div className="bxkr-card p-3 mb-2">Loading…</div>;
  const items = Array.isArray(data?.items) ? data.items : [];
  if (!items.length) return null;

  return (
    <div className="mb-3" role="region" aria-label="Coach notifications">
      {items.map((n: any) => (
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
        borderRadius: 50,
        padding: "12px 16px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
        color: "#fff",
        marginBottom: 12,
      }}
    >
      <div
        style={{
          width: 40, height: 40, borderRadius: "50%", overflow: "hidden",
          border: "2px solid rgba(255,255,255,0.4)", marginRight: 12, flexShrink: 0,
        }}
        aria-hidden="true"
      >
        <img src={COACH_AVATAR_SRC} alt="Coach" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {title}
        </div>
        <div style={{ fontSize: 13, opacity: 0.95 }}>{message}</div>
      </div>
      <i className="fas fa-chevron-right" aria-hidden="true" style={{ marginLeft: 12, color: "#fff" }} />
    </div>
  );

  return href ? (
    <Link href={href} className="text-decoration-none" aria-label={`${title}: ${message}`}>
      {content}
    </Link>
  ) : content;
}
