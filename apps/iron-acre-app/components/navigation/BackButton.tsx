import React from "react";
import { useRouter } from "next/router";
import { useEffect, useRef } from "react";

type BackButtonProps = {
  fallbackHref?: string;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  iconOnly?: boolean;
};

export default function BackButton({
  fallbackHref = "/",
  label = "Back",
  className,
  style,
  iconOnly = false,
}: BackButtonProps) {
  const router = useRouter();
  const canGoBack = useRef(false);

  useEffect(() => {
    // If the user arrived here via internal navigation, history length is usually > 1.
    // On hard refresh / direct load, it can be 1, so we fall back to fallbackHref.
    try {
      canGoBack.current = window.history.length > 1;
    } catch {
      canGoBack.current = false;
    }
  }, []);

  function handleBack() {
    if (canGoBack.current) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className={className ?? "btn btn-sm btn-outline-light"}
      style={{
        borderRadius: 12,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
        ...style,
      }}
      aria-label={label}
      title={label}
    >
      <i className="fas fa-arrow-left" />
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}
