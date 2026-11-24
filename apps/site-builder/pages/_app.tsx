import type { AppProps } from "next/app";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import "../styles/globals.css";
import "../styles/sitebuilder.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={(pageProps as { session?: Session | null }).session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
