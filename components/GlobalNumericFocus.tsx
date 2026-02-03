"use client";

import { useEffect } from "react";

/**
 * Globally improves numeric input UX:
 * - When a number input receives focus, select its full contents.
 *   This avoids typing "020" over a default value of 0 — typing replaces it.
 * - Hydration-safe: attaches in useEffect only.
 */
export default function GlobalNumericFocus() {
  useEffect(() => {
    function onFocus(e: FocusEvent) {
      const target = e.target as HTMLInputElement | null;
      if (!target) return;
      const isNumber =
        target.tagName === "INPUT" &&
        ((target.getAttribute("type") || "").toLowerCase() === "number" ||
          (target.getAttribute("inputmode") || "").toLowerCase() === "numeric" ||
          (target.getAttribute("inputmode") || "").toLowerCase() === "decimal");
      if (!isNumber) return;

      // Defer selection slightly to ensure focus is fully applied
      setTimeout(() => {
        try {
          // Selecting replaces content on type -> no "020"
          target.select();
        } catch {
          /* ignore */
        }
      }, 0);
    }

    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, []);

  return null;
}
