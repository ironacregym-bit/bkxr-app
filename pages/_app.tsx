// pages/_app.tsx
import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import "../styles/bootstrap.css";
import "../styles/gymworkout.css";
import { appFont } from "../lib/fonts";

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
      {/* ✅ Apply global font here */}
      <div className={appFont.variable}>
        <NotificationsInit />
        <BillingTrialBanner />
        <Component {...pageProps} />
      </div>
    </SessionProvider>
  );
}
