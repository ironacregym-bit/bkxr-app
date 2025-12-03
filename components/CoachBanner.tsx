
"use client";

import Link from "next/link";

export default function CoachBanner({ message, dateKey }: { message: string; dateKey: string }) {
  return (
    <Link
      href={`/nutrition?date=${dateKey}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "linear-gradient(90deg, #3a2f2f, #2e1a0f)", // warm brown gradient
        borderRadius: "50px",
        padding: "12px 16px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        color: "#fff",
        textDecoration: "none",
        marginBottom: "16px",
      }}
    >
      {/* Left Icon */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.1)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginRight: "12px",
        }}
      >
        <i className="fas fa-crown" style={{ color: "#ffcc00", fontSize: "18px" }}></i>
      </div>

      {/* Text */}
      <div style={{ flexGrow: 1 }}>
        <div style={{ fontWeight: 600, fontSize: "16px" }}>Don’t forget!</div>
        <div style={{ fontSize: "13px", opacity: 0.8 }}>{message}</div>
      </div>

      {/* Action Button */}
      <div
        style={{
          backgroundColor: "#fff",
          color: "#2e1a0f",
          fontWeight: 600,
          borderRadius: "24px",
          padding: "6px 16px",
          fontSize: "14px",
        }}
      >
        Start
      </div>
    </Link>
  );
}
