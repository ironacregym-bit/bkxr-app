// pages/_app.tsx
import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import "../styles/bootstrap.css";
import "../styles/gymworkout.css";
import "../styles/ironacre-ui.css";
import { appFont } from "../lib/fonts";

import NotificationsInit from "../components/NotificationsInit";
import BillingTrialBanner from "../components/BillingTrialBanner";

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.error("Service worker registration failed:", err));
    }
  }, []);

  return (
    <SessionProvider session={(pageProps as any).session}>
      <div className={appFont.variable}>
        <NotificationsInit />
        <BillingTrialBanner />
        <Component {...pageProps} />
      </div>
    </SessionProvider>
  );
}
