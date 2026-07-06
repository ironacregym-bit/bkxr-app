import { useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

const DISMISS_KEY = "iron_acre_a2hs_dismissed_until";
const DISMISS_DAYS = 14;

function getDismissUntil() {
  if (typeof window === "undefined") return 0;

  const raw = window.localStorage.getItem(DISMISS_KEY);
  const value = Number(raw || 0);

  return Number.isFinite(value) ? value : 0;
}

function setDismissUntil(days: number) {
  if (typeof window === "undefined") return;

  const until = Date.now() + days * 24 * 60 * 60 * 1000;
  window.localStorage.setItem(DISMISS_KEY, String(until));
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (window.navigator as any).standalone === true
  );
}

function isIOSLikeDevice() {
  if (typeof window === "undefined") return false;

  const ua = window.navigator.userAgent || "";
  const platform = window.navigator.platform || "";
  const maxTouchPoints = window.navigator.maxTouchPoints || 0;

  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
}

function isAndroidLikeDevice() {
  if (typeof window === "undefined") return false;

  return /android/i.test(window.navigator.userAgent || "");
}

export default function AddToHomeScreen() {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isIOS = useMemo(() => {
    if (!mounted) return false;
    return isIOSLikeDevice();
  }, [mounted]);

  const isAndroid = useMemo(() => {
    if (!mounted) return false;
    return isAndroidLikeDevice();
  }, [mounted]);

  const isStandalone = useMemo(() => {
    if (!mounted) return false;
    return isStandaloneMode();
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (isStandalone) return;

    const dismissedUntil = getDismissUntil();
    if (dismissedUntil > Date.now()) return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();

      setDeferredPrompt(event as BeforeInstallPromptEvent);

      window.setTimeout(() => {
        if (!isStandaloneMode()) {
          setShow(true);
        }
      }, 1400);
    };

    const handleAppInstalled = () => {
      setShow(false);
      setDeferredPrompt(null);
      setDismissUntil(365);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    if (isIOS) {
      window.setTimeout(() => {
        if (!isStandaloneMode() && getDismissUntil() <= Date.now()) {
          setShow(true);
        }
      }, 1800);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [mounted, isIOS, isStandalone]);

  function close() {
    setShow(false);
    setDismissUntil(DISMISS_DAYS);
  }

  async function install() {
    if (!deferredPrompt) return;

    setInstalling(true);

    try {
      await deferredPrompt.prompt();

      const choice = await deferredPrompt.userChoice;

      setDeferredPrompt(null);

      if (choice.outcome === "accepted") {
        setShow(false);
        setDismissUntil(365);
      } else {
        setShow(false);
        setDismissUntil(DISMISS_DAYS);
      }
    } finally {
      setInstalling(false);
    }
  }

  if (!mounted) return null;
  if (!show) return null;
  if (isStandalone) return null;

  const canPromptInstall = Boolean(deferredPrompt);

  return (
    <div
      className="ia-a2hs-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Install Iron Acre app"
      onClick={close}
    >
      <div className="ia-a2hs-card" onClick={(event) => event.stopPropagation()}>
        <div className="ia-a2hs-icon">
          /iron_acre_logo_transparent.png
        </div>

        <div className="ia-kicker">
          <i className="fas fa-mobile-screen-button" />
          install app
        </div>

        <div className="ia-page-title mt-2">Add Iron Acre to your home screen</div>

        {isIOS ? (
          <div className="ia-a2hs-copy mt-2">
            For iPhone or iPad, tap the <strong>Share</strong> button in Safari, then choose{" "}
            <strong>Add to Home Screen</strong>.
          </div>
        ) : canPromptInstall ? (
          <div className="ia-a2hs-copy mt-2">
            Install Iron Acre like an app for quicker access, full-screen use and a cleaner member
            experience.
          </div>
        ) : isAndroid ? (
          <div className="ia-a2hs-copy mt-2">
            If the install button is not available yet, open the browser menu and choose{" "}
            <strong>Install app</strong> or <strong>Add to Home screen</strong>.
          </div>
        ) : (
          <div className="ia-a2hs-copy mt-2">
            You can install Iron Acre from your browser menu if your browser supports web app
            installation.
          </div>
        )}

        {isIOS ? (
          <div className="ia-a2hs-steps mt-3">
            <div className="ia-a2hs-step">
              <span>1</span>
              Tap the Share icon.
            </div>
            <div className="ia-a2hs-step">
              <span>2</span>
              Select Add to Home Screen.
            </div>
            <div className="ia-a2hs-step">
              <span>3</span>
              Tap Add.
            </div>
          </div>
        ) : null}

        <div className="d-grid gap-2 mt-3">
          {!isIOS && canPromptInstall ? (
            <button
              type="button"
              className="ia-btn ia-btn-primary w-100"
              onClick={install}
              disabled={installing}
              style={{ minHeight: 42 }}
            >
              <i className="fas fa-download" />
              {installing ? "Opening install..." : "Install Iron Acre"}
            </button>
          ) : null}

          <button
            type="button"
            className="ia-btn ia-btn-muted w-100"
            onClick={close}
            style={{ minHeight: 40 }}
          >
            Not now
          </button>
        </div>
      </div>

      <style jsx>{`
        .ia-a2hs-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999;
          padding: 18px;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          background: rgba(0, 0, 0, 0.62);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .ia-a2hs-card {
          width: min(430px, 100%);
          border-radius: 22px;
          padding: 18px;
          color: #fff;
          background: linear-gradient(
            180deg,
            rgba(14, 19, 27, 0.98) 0%,
            rgba(10, 14, 20, 0.98) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.5);
          animation: iaA2hsSlide 0.24s ease-out;
        }

        .ia-a2hs-icon {
          width: 58px;
          height: 58px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 12px;
          background: rgba(24, 255, 154, 0.1);
          border: 1px solid rgba(24, 255, 154, 0.22);
        }

        .ia-a2hs-icon img {
          width: 46px;
          height: 46px;
          object-fit: contain;
          display: block;
        }

        .ia-a2hs-copy {
          color: var(--ia-muted);
          font-size: 0.84rem;
          line-height: 1.45;
        }

        .ia-a2hs-copy strong {
          color: #fff;
          font-weight: 700;
        }

        .ia-a2hs-steps {
          display: grid;
          gap: 8px;
        }

        .ia-a2hs-step {
          display: flex;
          align-items: center;
          gap: 10px;
          color: rgba(255, 255, 255, 0.88);
          font-size: 0.82rem;
          padding: 9px 10px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ia-a2hs-step span {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          color: #041311;
          font-size: 0.72rem;
          font-weight: 800;
          background: linear-gradient(135deg, var(--ia-neon), var(--ia-neon2));
        }

        @keyframes iaA2hsSlide {
          from {
            opacity: 0;
            transform: translateY(18px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (min-width: 640px) {
          .ia-a2hs-backdrop {
            align-items: center;
          }
        }
      `}</style>
    </div>
  );
}
