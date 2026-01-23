
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function AddToHomeScreen() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const isIOS =
    typeof window !== "undefined" &&
    /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  const isInStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true);

  useEffect(() => {
    if (isInStandalone) return;
    if (localStorage.getItem("A2HS-dismissed") === "true") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // iOS never fires beforeinstallprompt
    if (isIOS) setShow(true);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const close = () => {
    setShow(false);
    localStorage.setItem("A2HS-dismissed", "true");
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      close();
    }
  };

  if (!show) return null;

  return (
    <div
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        padding: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "fadeIn 0.3s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 92vw)",
          background: "#fff",
          borderRadius: "20px",
          padding: "24px",
          textAlign: "center",
          animation: "slideUp 0.4s ease-out",
        }}
      >
        {!isIOS ? (
          <>
            <h2 style={{ fontWeight: 700, marginBottom: 8 }}>
              Add BXKR to Your Home Screen
            </h2>
            <p style={{ marginBottom: 20, color: "#444" }}>
              Install BXKR like a real app for faster access and a better
              full‑screen experience.
            </p>
            <button
              className="btn btn-primary w-100 mb-2"
              onClick={install}
              style={{ borderRadius: 12 }}
            >
              Install App
            </button>
          </>
        ) : (
          <>
            <h2 style={{ fontWeight: 700, marginBottom: 8 }}>
              Install BXKR
            </h2>
            <p style={{ marginBottom: 20, color: "#444" }}>
              Tap the <strong>Share</strong> icon →{" "}
              <strong>Add to Home Screen</strong>.
            </p>
          </>
        )}

        <button
          className="btn btn-light w-100"
          onClick={close}
          style={{ borderRadius: 12 }}
        >
          Not now
        </button>
      </div>

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }

          @keyframes slideUp {
            from { transform: translateY(40px); opacity: 0; }
            to   { transform: translateY(0); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}
