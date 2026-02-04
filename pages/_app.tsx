
// pages/_app.tsx
import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import "../styles/bootstrap.css";

import NotificationsInit from "../components/NotificationsInit";
import BillingTrialBanner from "../components/BillingTrialBanner";

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Register a single service worker: /sw.js
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.error("Service worker registration failed:", err));
    }
  }, []);

  return (
    <SessionProvider session={(pageProps as any).session}>
      {/* Headless initialiser: asks permission, subscribes to push, posts subscription to server */}
      <NotificationsInit />

      <Component {...pageProps} />
    </SessionProvider>
  );
}
