
"use client";

import Link from "next/link";

type ChallengeBannerProps = {
  /** Challenge title (e.g., "New Challenge") */
  title: string;
  /** Subtitle or description (e.g., "2 Weeks of Energy") */
  message: string;
  /** Link target for the banner action button */
  href: string;
  /** Font Awesome icon class for the left icon */
  iconLeft?: string;
  /** Accent color for the icon (e.g., "#ffcc00") */
  accentColor?: string;
  /** Button label (default: "Start") */
  buttonText?: string;
  /** Optional gradient override for banner background */
  background?: string;
};

export default function ChallengeBanner({
  title,
  message,
  href,
  iconLeft = "fas fa-crown",
  accentColor = "#ffcc00",
  buttonText = "Start",
  background = "linear-gradient(90deg, #d97a3a, #ffb347)", // bright amber gradient
}: ChallengeBannerProps) {
  return (
    <Link
      href={href}
      aria-label={`${title}: ${message}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background,
        borderRadius: "50px",
        padding: "14px 18px",
        boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
        color: "#fff",
        textDecoration: "none",
        marginBottom: "18px",
      }}
    >
      {/* Icon circle */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.15)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginRight: "14px",
          flexShrink: 0,
        }}
      >
        <i className={iconLeft} style={{ color: accentColor, fontSize: 20 }} />
      </div>

      {/* Text block */}
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
        <div style={{ fontSize: 13, opacity: 0.9 }}>{message}</div>
      </div>

      {/* Action button */}
      <div
        role="button"
        style={{
          backgroundColor: "#fff",
          color: "#0e0e0e",
          fontWeight: 600,
          borderRadius: "24px",
          padding: "8px 18px",
          fontSize: 14,
          display: "inline-flex",
          alignItems: "center",
          marginLeft: 14,
          flexShrink: 0,
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        }}
      >
        {buttonText}
      </div>
    </Link>
  );
}
