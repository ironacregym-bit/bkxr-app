
// pages/_app.tsx
import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import "../styles/bootstrap.css";
import AddToHomeScreen from "../components/AddToHomeScreen";
import NotificationsInit from "../components/NotificationsInit";

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Register your existing SW (if you use it for caching/PWA shell)
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Register the generic SW (your existing one)
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) =>
          console.error("Service worker registration failed:", err)
        );

      // Also register the notification-specific SW for Web Push
      // If you decide to have a single SW, move the push handlers into /sw.js
      navigator.serviceWorker
        .register("/notification-sw.js", { scope: "/" })
        .catch((err) =>
          console.error("Notification SW registration failed:", err)
        );
    }
  }, []);

  return (
    <SessionProvider session={(pageProps as any).session}>
      {/* Headless initialiser: asks for permission, subscribes, posts subscription to server */}
      <NotificationsInit />

      {/* Your global PWA banner (keep as you had) */}
      <AddToHomeScreen />

      <Component {...pageProps} />
    </SessionProvider>
  );
}
