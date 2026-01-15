
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* PWA: Manifest (ensure this file exists at /public) */}
        {/* If your file is manifest.webmanifest, switch href accordingly */}
        <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials" />

        {/* Theme / Colours for PWA UI */}
        <meta name="theme-color" content="#0E0F12" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BXKR" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180.png" />

        {/* Favicons / icons */}
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
        {/* Optional pinned tab for Safari (macOS) */}
        <link rel="mask-icon" href="/icons/safari-pinned-tab.svg" color="#ff7f32" />

        {/* Font Awesome (CDN) – consider local hosting; add SRI for security */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>

        {/* ===== Global Safe Area Spacer for BottomNav ===== */}
        <style>{`
          :root {
            --bxkr-bottomnav-height: 84px;
          }
          /* Ensure content isn't obscured by the fixed BottomNav or iOS home indicator */
          body {
            padding-bottom: calc(env(safe-area-inset-bottom, 0px) + var(--bxkr-bottomnav-height));
            background-color: #0E0F12; /* matches theme for flashes */
          }
          html, body {
            overscroll-behavior: contain;
          }

          /* Optional: standalone tweaks (when installed) */
          @media all and (display-mode: standalone) {
            body { background-color: #0E0F12; }
          }
        `}</style>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
