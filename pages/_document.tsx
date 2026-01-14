import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="mobile-web-app-capable" content="yes" />
        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Font Awesome */}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"/>

        {/* App Icons */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" href="/icons/icon-192.png" />

        {/* Theme / Colours */}
        <meta name="theme-color" content="#000000" />

        {/* iOS PWA Settings */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BXKR" />

        {/* ===== Global Safe Area Spacer for BottomNav ===== */}
        <style>{`
          :root {
            /* Height of the fixed BottomNav (pill container + padding).
               Tweak once here if you change the BottomNav size. */
            --bxkr-bottomnav-height: 84px;
          }

          /* Ensure content isn't obscured by the fixed BottomNav or iOS home indicator */
          body {
            padding-bottom: calc(env(safe-area-inset-bottom, 0px) + var(--bxkr-bottomnav-height));
          }

          /* Optional: smooth scrolling feel and prevent bounce issues */
          html, body {
            overscroll-behavior: contain;
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
