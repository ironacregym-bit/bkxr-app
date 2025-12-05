
"use client";

import Link from "next/link";

type BxkrBannerProps = {
  /** Left header text (bold). Defaults to “Reminder”. */
  title?: string;
  /** Supporting text under the title. */
  message: string;
  /** Link target for the whole banner action button. */
  href: string;
  /** Left circular icon class, e.g. "fas fa-dumbbell". */
  iconLeft?: string;
  /** Button label, e.g. "Start", "Fill", "Check in". Defaults to "Start". */
  buttonText?: string;
  /** Button icon class (to the left of the button text). Defaults to "fas fa-crown". */
  buttonIcon?: string;
};

export default function BxkrBanner({
  title = "Reminder",
  message,
  href,
  iconLeft = "fas fa-crown",
  buttonText = "Start",
  buttonIcon = "fas fa-crown",
}: BxkrBannerProps) {
  return (
    <Link
      href={href}
      aria-label={`${title}: ${message}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "linear-gradient(90deg, #3a2f2f, #2e1a0f)", // warm brown gradient (matches your CoachBanner)
        borderRadius: "50px",
        padding: "12px 16px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        color: "#fff",
        textDecoration: "none",
        marginBottom: "16px",
      }}
    >
      {/* Left Icon circle */}
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
          flexShrink: 0,
        }}
        aria-hidden="true"
      >
        <i className={iconLeft} style={{ color: "#ffcc00", fontSize: 18 }} />
      </div>

      {/* Text block */}
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {title}
        </div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          {message}
        </div>
      </div>

      {/* Action button – white pill with icon (matches CoachBanner exactly) */}
      <div
        style={{
          backgroundColor: "#fff",
          color: "#2e1a0f",
          fontWeight: 600,
          borderRadius: "24px",
          padding: "6px 16px",
          fontSize: 14,
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          marginLeft: 12,
          flexShrink: 0,
        }}
      >
        <i className={buttonIcon} style={{ color: "#ffcc00", fontSize: 14 }} />
        {buttonText}
      </div>
    </Link>
  );
}
