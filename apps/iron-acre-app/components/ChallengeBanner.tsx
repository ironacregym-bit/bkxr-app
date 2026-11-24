
"use client";

import React from "react";
import Link from "next/link";

type ChallengeBannerProps = {
  title: string;
  message: string | React.ReactNode;
  href?: string;
  iconLeft?: string;
  accentColor?: string;
  buttonText?: string;
  showButton?: boolean;
  buttonDisabled?: boolean;
  extraContent?: React.ReactNode;
  background?: string;
  style?: React.CSSProperties;
};

export default function ChallengeBanner({
  title,
  message,
  href = "#",
  iconLeft = "fas fa-crown",
  accentColor = "#ff8a2a", // Neon Orange default
  buttonText = "Start",
  showButton = true,
  buttonDisabled = false,
  extraContent,
  background = "linear-gradient(135deg, #ff7f32, #ff9a3a)", // BXKR gradient
  style,
}: ChallengeBannerProps) {
  const handleClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    if (buttonDisabled || href === "#") {
      e.preventDefault();
    }
  };

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
    minWidth: 220,
    transition: "transform .18s ease, box-shadow .18s ease",
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
    background: "linear-gradient(135deg, #ff7f32, #ff9a3a)",
    color: "#fff",
    fontWeight: 600,
    borderRadius: "999px",
    padding: "8px 18px",
    fontSize: 14,
    display: "inline-flex",
    alignItems: "center",
    marginLeft: 14,
    flexShrink: 0,
    boxShadow: "0 0 12px rgba(255,127,50,0.6)",
    opacity: buttonDisabled ? 0.6 : 1,
    cursor: buttonDisabled ? "not-allowed" : "pointer",
    transition: "box-shadow .2s ease, transform .2s ease",
  };

  const rightSlot = extraContent ? (
    <div style={{ marginLeft: 14, flexShrink: 0 }}>{extraContent}</div>
  ) : showButton ? (
    <div role="button" style={buttonStyle}>{buttonText}</div>
  ) : null;

  return (
    <Link
      href={href}
      aria-label={`${title}: ${typeof message === "string" ? message : ""}`}
      style={wrapperStyle}
      onClick={handleClick}
    >
      <div style={iconCircleStyle}>
        <i className={iconLeft} style={{ color: accentColor, fontSize: 20 }} />
      </div>
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div style={titleStyle}>{title}</div>
        <div style={messageStyle}>{message}</div>
      </div>
      {rightSlot}
    </Link>
  );
}
