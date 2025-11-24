import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import "../styles/bootstrap.css";
export default function App({ Component, pageProps }: AppProps) {
  return <SessionProvider><Component {...pageProps} /></SessionProvider>;
}
