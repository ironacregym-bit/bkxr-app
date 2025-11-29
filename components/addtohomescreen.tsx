"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function AddToHomeScreen() {
  const pathname = usePathname();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Only show on home page
    if (pathname !== "/") return;

    const isIos =
      /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

    // Detect if PWA is already installed
    const isInStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Legacy iOS
      (window.navigator as any).standalone === true;

    if (isIos && !isInStandalone) {
      setShowPrompt(true);
    }
  }, [pathname]);

  if (!showPrompt) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "white",
        padding: "16px",
        borderRadius: "12px",
        boxShadow: "0 4px 18px rgba(0,0,0,0.15)",
        maxWidth: "90%",
        zIndex: 9999,
        textAlign: "center",
      }}
    >
      <p style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>
        Add this app to your Home Screen
      </p>
      <p style={{ margin: "6px 0 0", fontSize: "13px" }}>
        Tap the <span style={{ fontWeight: 700 }}>Share</span> icon →  
        <span style={{ fontWeight: 700 }}>“Add to Home Screen”</span>
      </p>
    </div>
  );
}