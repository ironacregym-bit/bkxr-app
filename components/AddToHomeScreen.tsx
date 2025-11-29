import { useEffect, useState } from "react";

export default function AddToHomeScreen() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  // Detect iOS
  const isIOS =
    typeof window !== "undefined" &&
    /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  // Detect installed PWA mode
  const isInStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true);

  useEffect(() => {
    // Don’t show again if dismissed
    if (localStorage.getItem("A2HS-dismissed") === "true") return;

    // Don’t show if already installed
    if (isInStandalone) return;

    // ANDROID HANDLING
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // iOS has no event → show manually
    if (isIOS) {
      setShow(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("A2HS-dismissed", "true");
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setShow(false);
    }
  };

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        maxWidth: "90%",
        animation: "slideUp 0.4s ease-out",
      }}
    >
      <div
        className="card shadow-lg p-3"
        style={{
          borderRadius: "16px",
          background: "white",
        }}
      >
        {!isIOS && (
          <>
            <h6 className="mb-2">Add this app to your home screen</h6>
            <p className="mb-3 small text-muted">
              Get faster access next time, no browser needed.
            </p>
            <button className="btn btn-primary w-100 mb-2" onClick={install}>
              Add to Home Screen
            </button>
          </>
        )}

        {isIOS && (
          <>
            <h6 className="mb-2">Install this app</h6>
            <p className="small text-muted mb-2">
              Tap the <strong>Share</strong> icon → <strong>“Add to Home Screen”</strong>.
            </p>
          </>
        )}

        <button className="btn btn-light w-100" onClick={dismiss}>
          Dismiss
        </button>
      </div>

      <style>
        {`
        @keyframes slideUp {
            from { transform: translate(-50%, 40px); opacity: 0; }
            to   { transform: translate(-50%, 0px);  opacity: 1; }
        }
        `}
      </style>
    </div>
  );
}