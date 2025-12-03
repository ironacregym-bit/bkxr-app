
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type CoachBannerProps = {
  message: string;
  onDismiss?: () => void;
  dateKey: string; // e.g., "2025-12-02"
};

export default function CoachBanner({ message, onDismiss, dateKey }: CoachBannerProps) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const key = `bxkr_banner_dismissed_${dateKey}`;
    const dismissed = localStorage.getItem(key) === "1";
    setHidden(dismissed);
  }, [dateKey]);

  const handleDismiss = () => {
    const key = `bxkr_banner_dismissed_${dateKey}`;
    localStorage.setItem(key, "1");
    setHidden(true);
    onDismiss?.();
  };

  if (hidden) return null;

  return (
    <div
      className="d-flex align-items-center p-2 mb-3"
      style={{
        background: "rgba(255,255,255,0.08)",
        backdropFilter: "blur(8px)",
        borderRadius: "16px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
        color: "#fff",
      }}
    >
      <div
        className="me-3 d-flex align-items-center justify-content-center"
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "rgba(255,127,50,0.2)",
          boxShadow: "0 0 10px rgba(255,127,50,0.5)",
        }}
      >
        {/* Use your coach avatar here; fallback to a default */}
        /coach.png
      </div>

      <div className="flex-grow-1">
        <div className="fw-semibold" style={{ color: "#ff7f32" }}>Coach</div>
        <div className="small" style={{ opacity: 0.9 }}>{message}</div>
      </div>

      <button
        className="btn btn-sm btn-outline-light ms-2"
        style={{ borderRadius: "24px" }}
        onClick={handleDismiss}
        aria-label="Dismiss coach reminder"
      >
        Dismiss
      </button>
    </div>
  );
}
