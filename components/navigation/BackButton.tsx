import { useRouter } from "next/router";
import { useEffect, useRef } from "react";

type BackButtonProps = {
  fallbackHref?: string;      // where to go if no history
  label?: string;             // default: Back
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
  const hasHistory = useRef(false);

  useEffect(() => {
    // If the history length is > 1, we can go back safely
    if (window.history.length > 1) {
      hasHistory.current = true;
    }
  }, []);

  function handleBack() {
    if (hasHistory.current) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
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
        ...style,
      }}
      aria-label="Go back"
    >
      <i className="fas fa-arrow-left" />
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}
