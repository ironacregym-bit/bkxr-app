
"use client";

import Link from "next/link";

/**
 * BXKR banner — reusable pill notification matching your CoachBanner style,
 * with per-notification accent colour control.
 */
type BxkrBannerProps = {
  /** Left header text (bold). Defaults to “Reminder”. */
  title?: string;
  /** Supporting text under the title. */
  message: string;
  /** Link target for the banner action button. */
  href: string;
  /** Font Awesome class for the left icon (e.g., "fas fa-dumbbell"). */
  iconLeft?: string;
  /**
   * Accent colour applied to:
   *  - the left icon colour
   *  - the action button background colour
   * e.g., "#ff7f32", "#2ecc71"
   */
  accentColor?: string;
  /** Action button label. Defaults to "Start". */
  buttonText?: string;
  /**
   * Optional override for the banner background (keeps your warm brown default).
   * Provide a CSS color/gradient string if you want to theme per banner.
   */
  background?: string;
};

export default function BxkrBanner({
  title = "Reminder",
  message,
  href,
  iconLeft = "fas fa-crown",
  accentColor = "#ffcc00",
  buttonText = "Start",
  background = "linear-gradient(90deg, #3a2f2f, #2e1a0f)", // matches your CoachBanner
}: BxkrBannerProps) {
  // Decide button text color based on accent (simple luminance check)
  const btnTextColor = getReadableTextColor(accentColor);

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
        <i className={iconLeft} style={{ color: accentColor, fontSize: 18 }} />
      </div>

      {/* Text block */}
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 16,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 13, opacity: 0.85 }}>{message}</div>
      </div>

      {/* Action button — pill, colour = accentColor, no icon (per request) */}
      <div
        role="button"
        style={{
          backgroundColor: accentColor,
          color: btnTextColor,
          fontWeight: 600,
          borderRadius: "24px",
          padding: "6px 16px",
          fontSize: 14,
          display: "inline-flex",
          alignItems: "center",
          gap: 0,
          marginLeft: 12,
          flexShrink: 0,
          boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        }}
      >
        {buttonText}
      </div>
    </Link>
  );
}

/**
 * Very light luminance-based contrast heuristic:
 * returns "#0e0e0e" (dark) for light accents, "#ffffff" for dark accents.
 */
function getReadableTextColor(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#0e0e0e";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b; // Rec. 709
  return luminance > 160 ? "#0e0e0e" : "#ffffff";
}
