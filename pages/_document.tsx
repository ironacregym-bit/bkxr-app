// pages/_document.tsx
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" crossOrigin="use-credentials" />

        {/* Theme / colours for browser UI */}
        <meta name="theme-color" content="#0E0F12" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* iOS PWA */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Iron Acre Gym" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180x180.png" />

        {/* Favicons / icons */}
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
        <link rel="mask-icon" href="/icons/safari-pinned-tab.svg" color="#ff7f32" />

        {/* Font Awesome CDN */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
        />

        {/* Global safe area spacer for BottomNav */}
        <style>{`
          :root {
            --bxkr-bottomnav-height: 84px;
          }

          html,
          body {
            overscroll-behavior: contain;
            background-color: #0E0F12;
          }

          body {
            padding-bottom: calc(env(safe-area-inset-bottom, 0px) + var(--bxkr-bottomnav-height));
          }

          @media all and (display-mode: standalone) {
            body {
              background-color: #0E0F12;
            }
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
