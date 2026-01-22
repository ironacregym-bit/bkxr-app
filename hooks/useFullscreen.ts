
// hooks/useFullscreen.ts
"use client";

import { useCallback, useEffect, useState } from "react";

export default function useFullscreen(targetRef: React.RefObject<HTMLElement>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const enter = useCallback(async () => {
    const el = targetRef.current as any;
    if (!el) return;
    if (document.fullscreenElement) return;
    try {
      await (el.requestFullscreen?.() || el.webkitRequestFullscreen?.());
      setIsFullscreen(true);
    } catch {}
  }, [targetRef]);

  const exit = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen?.();
      // @ts-ignore
      else if (document.webkitFullscreenElement) await document.webkitExitFullscreen?.();
    } catch {}
    setIsFullscreen(false);
  }, []);

  const toggle = useCallback(() => {
    if (isFullscreen) exit(); else enter();
  }, [isFullscreen, enter, exit]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    // @ts-ignore
    document.addEventListener?.("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      // @ts-ignore
      document.removeEventListener?.("webkitfullscreenchange", onChange);
    };
  }, []);

  return { isFullscreen, enter, exit, toggle };
}
