"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Food } from "./FoodEditor";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onFoundFood: (food: Food) => void;
  onLookupBarcode: (code: string) => Promise<Food | undefined>;
};

export default function BarcodeScannerClient({
  isOpen,
  onClose,
  onFoundFood,
  onLookupBarcode,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<any>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const scannedOnce = useRef(false);

  const [scanError, setScanError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string>("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [restartTick, setRestartTick] = useState(0);

  function stopTracks() {
    try {
      const v = videoRef.current;
      if (v?.srcObject) {
        (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        v.srcObject = null;
      }
    } catch {}
  }

  async function teardown() {
    try { controlsRef.current?.stop?.(); } catch {}
    try { readerRef.current?.reset?.(); } catch {}
    stopTracks();
  }

  async function startScanner(mountedRef: { current: boolean }) {
    setScanError(null);
    setBarcodeInput("");
    setLastCode("");
    scannedOnce.current = false;

    if (videoRef.current) {
      videoRef.current.setAttribute("playsinline", "true");
      videoRef.current.muted = true;
      videoRef.current.autoplay = true;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setHasCamera(false);
      return;
    }

    try {
      setScanning(true);
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const videoInputs = await BrowserMultiFormatReader.listVideoInputDevices();
      if (!videoInputs || videoInputs.length === 0) {
        setHasCamera(false);
        setScanning(false);
        return;
      }
      const backLike = videoInputs.find((d) => /back|rear|environment/i.test(d.label || ""));
      const chosen = backLike || videoInputs[videoInputs.length - 1];

      const controls = await reader.decodeFromVideoDevice(
        chosen.deviceId,
        videoRef.current!,
        async (result /* , err */) => {
          if (!mountedRef.current) return;
          if (result && !scannedOnce.current) {
            scannedOnce.current = true;
            const code = result.getText();
            setLastCode(code);

            try {
              setLookupLoading(true);
              const found = await onLookupBarcode(code);
              if (!found) {
                setScanError("No product found for this barcode.");
                scannedOnce.current = false;
              } else {
                onFoundFood(found);
                onClose();
              }
            } catch {
              setScanError("Barcode lookup failed. Please try again or enter manually.");
              scannedOnce.current = false;
            } finally {
              setLookupLoading(false);
            }
          }
        }
      );

      if (!mountedRef.current) {
        controls?.stop?.();
        return;
      }
      controlsRef.current = controls;
    } catch (err: any) {
      console.error("[scanner] start error:", err?.message || err);
      setScanError("Unable to access the camera. Enter the barcode manually.");
      setHasCamera(false);
      setScanning(false);
      await teardown();
      return;
    } finally {
      setScanning(false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;

    const mountedRef = { current: true };
    startScanner(mountedRef);

    const onVisibility = async () => {
      if (document.visibilityState === "hidden") {
        await teardown();
      } else if (document.visibilityState === "visible" && mountedRef.current) {
        setRestartTick((t) => t + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      teardown();
    };
  }, [isOpen, onClose, onFoundFood, onLookupBarcode, restartTick]);

  async function lookupManualBarcode() {
    const code = (barcodeInput || "").trim();
    if (!code || code.length < 6) {
      setScanError("Enter a valid barcode (at least 6 digits).");
      return;
    }
    try {
      setLookupLoading(true);
      const found = await onLookupBarcode(code);
      if (!found) {
        setLastCode(code);
        setScanError("No product found for this barcode.");
      } else {
        onFoundFood(found);
        onClose();
      }
    } finally {
      setLookupLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="bxkr-modal">
      <div className="bxkr-modal-backdrop" onClick={onClose} />
      <div className="bxkr-modal-dialog bxkr-card">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h5 className="mb-0">Scan barcode</h5>
          <div className="d-flex gap-2">
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setRestartTick((t) => t + 1)}
              title="Restart camera"
            >
              Restart
            </button>
            <button className="btn btn-bxkr-outline" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {hasCamera ? (
          <>
            <div className="scanner-box mb-2">
              <video ref={videoRef} className="scanner-video" autoPlay playsInline muted />
              <div className="scanner-hint text-dim">
                Align the barcode within the frame. {scanning ? "Scanning…" : "Initialising…"}
              </div>
            </div>

            <div className="d-flex gap-2">
              <input
                className="form-control"
                placeholder="e.g. 5051234567890"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                inputMode="numeric"
              />
              <button className="btn btn-bxkr" onClick={lookupManualBarcode} disabled={lookupLoading}>
                {lookupLoading ? "Looking up…" : "Lookup"}
              </button>
            </div>

            {scanError && (
              <div className="mt-2">
                <div className="text-danger">{scanError}</div>
                {/* NEW: fast path to admin add form with code prefilled */}
                <a
                  href={`/admin/foods/barcodes?code=${encodeURIComponent(lastCode || barcodeInput)}`}
                  className="btn btn-sm btn-bxkr-outline mt-2"
                  style={{ borderRadius: 24 }}
                >
                  + Add this barcode
                </a>
              </div>
            )}
          </>
        ) : (
          <div className="mb-2">
            <div className="mb-2 text-dim">Camera not available. Enter the barcode manually:</div>
            <div className="d-flex gap-2">
              <input
                className="form-control"
                placeholder="e.g. 5051234567890"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                inputMode="numeric"
              />
              <button className="btn btn-bxkr" onClick={lookupManualBarcode} disabled={lookupLoading}>
                {lookupLoading ? "Looking up…" : "Lookup"}
              </button>
            </div>
            {scanError && (
              <div className="mt-2">
                <div className="text-danger">{scanError}</div>
                <a
                  href={`/admin/foods/barcodes?code=${encodeURIComponent(lastCode || barcodeInput)}`}
                  className="btn btn-sm btn-bxkr-outline mt-2"
                  style={{ borderRadius: 24 }}
                >
                  + Add this barcode
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
