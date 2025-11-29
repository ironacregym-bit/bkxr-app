import { useEffect } from "react";
import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import "../styles/bootstrap.css";

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) =>
          console.error("Service worker registration failed:", err)
        );
    }
  }, []);

  return (
    <SessionProvider session={pageProps.session}>
      <Component {...pageProps} />
      <addtohomescreen />
    </SessionProvider>
  );
}