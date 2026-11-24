
// hooks/useWakeLock.ts
"use client";

import { useEffect, useRef } from "react";

export type WakeLockOptions = {
  /** Re-request the lock when tab/app becomes visible again. Default true */
  reRequestOnVisibility?: boolean;
  /** For test environments or SSR stubs */
  doc?: Document;
  nav?: any;
};

// Overloads so calls with 1 or 2 args are valid
export default function useWakeLock(enabled: boolean): void;
export default function useWakeLock(enabled: boolean, opts?: WakeLockOptions): void;

export default function useWakeLock(enabled: boolean, opts?: WakeLockOptions) {
  const lockRef = useRef<any>(null);

  useEffect(() => {
    const doc = opts?.doc ?? (typeof document !== "undefined" ? document : undefined);
    const nav = opts?.nav ?? (typeof navigator !== "undefined" ? (navigator as any) : undefined);
    const reRequest = opts?.reRequestOnVisibility ?? true;

    let cancelled = false;

    async function requestLock() {
      if (!enabled) {
        release();
        return;
      }
      const api = nav?.wakeLock;
      if (!api?.request) return; // unsupported browser

      try {
        const sentry = await api.request("screen");
        if (cancelled) {
          try { await sentry.release(); } catch {}
          return;
        }
        lockRef.current = sentry;
        // Some impls fire 'release' events; not relied upon here.
        sentry.addEventListener?.("release", () => {
          // No-op; we conditionally re-request on visibilitychange instead.
        });
      } catch {
        // Ignored (permissions/unsupported)
      }
    }

    function release() {
      const current = lockRef.current;
      if (current) {
        try { current.release?.(); } catch {}
        lockRef.current = null;
      }
    }

    // Initial attempt
    requestLock();

    // Re-request when coming back to foreground, if desired
    const onVis = () => {
      if (!doc) return;
      if (reRequest && doc.visibilityState === "visible" && enabled) {
        requestLock();
      }
    };

    doc?.addEventListener?.("visibilitychange", onVis);

    return () => {
      cancelled = true;
      doc?.removeEventListener?.("visibilitychange", onVis);
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, opts?.reRequestOnVisibility]);
}
