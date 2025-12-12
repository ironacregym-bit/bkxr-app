
"use client";

import React from "react";
import Link from "next/link";

type ChallengeBannerProps = {
  /** Challenge title (e.g., "New Challenge") */
  title: string;

  /** Subtitle or description (string or JSX for richer layouts) */
  message: string | React.ReactNode;

  /** Link target for banner action */
  href?: string;

  /** Font Awesome icon class for the left icon */
  iconLeft?: string;

  /** Accent color for the icon (e.g., "#ffcc00") */
  accentColor?: string;

  /** Button label (default: "Start") */
  buttonText?: string;

  /**
   * Show the right-side button (default: true).
   * Set to false to hide the button area entirely.
   */
  showButton?: boolean;

  /**
   * Disabled state for the button (default: false).
   * When true, prevents navigation and renders disabled styles.
   */
  buttonDisabled?: boolean;

  /**
   * Optional custom content rendered to the far right.
   * If provided, it replaces the default button.
   * Example: a disabled “Coming soon” pill.
   */
  extraContent?: React.ReactNode;

  /** Optional gradient override for banner background */
  background?: string;

  /** Optional custom styles for the wrapper */
  style?: React.CSSProperties;
};

export default function ChallengeBanner({
  title,
  message,
  href = "#",
  iconLeft = "fas fa-crown",
  accentColor = "#ffcc00",
  buttonText = "Start",
  showButton = true,
  buttonDisabled = false,
  extraContent,
  background = "linear-gradient(90deg, #d97a3a, #ffb347)", // bright amber gradient
  style,
}: ChallengeBannerProps) {
  // Prevent navigation when buttonDisabled=true to act like “Coming soon”
  const handleClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    if (buttonDisabled || href === "#") {
      e.preventDefault();
    }
  };

  // Shared wrapper styles (keeps the same size/look you already use)
  const wrapperStyle: React.CSSProperties = {
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
    minWidth: 220, // stable width for your scroller lanes
    ...style,
  };

  const iconCircleStyle: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.15)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    marginRight: "14px",
    flexShrink: 0,
  };

  const titleStyle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: 16,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const messageStyle: React.CSSProperties = {
    fontSize: 13,
    opacity: 0.9,
    lineHeight: 1.4,
  };

  const buttonStyle: React.CSSProperties = {
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
    opacity: buttonDisabled ? 0.6 : 1,
    cursor: buttonDisabled ? "not-allowed" : "pointer",
  };

  // If extraContent is provided, render it instead of the default button
  const rightSlot = extraContent ? (
    <div style={{ marginLeft: 14, flexShrink: 0 }}>{extraContent}</div>
  ) : showButton ? (
    <div role="button" style={buttonStyle}>{buttonText}</div>
  ) : null;

  // Use Link for consistency with your existing implementation
  return (
    <Link href={href} aria-label={`${title}: ${typeof message === "string" ? message : ""}`} style={wrapperStyle} onClick={handleClick}>
      {/* Icon */}
      <div style={iconCircleStyle}>
        <i className={iconLeft} style={{ color: accentColor, fontSize: 20 }} />
      </div>

      {/* Text block */}
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div style={titleStyle}>{title}</div>
        <div style={messageStyle}>{message}</div>
      </div>

      {/* Right-side button / custom content */}
      {rightSlot}
    </Link>
  );
}
