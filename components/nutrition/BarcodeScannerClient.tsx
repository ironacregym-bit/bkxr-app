
"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Food } from "./FoodEditor";

export default function BarcodeScannerClient({
  isOpen,
  onClose,
  onFoundFood,
  onLookupBarcode,
}: {
  isOpen: boolean;
  onClose: () => void;
  onFoundFood: (food: Food) => void;
  onLookupBarcode: (code: string) => Promise<Food | undefined>;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<any>(null);
  const scannedOnce = useRef(false);

  const [scanError, setScanError] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [lookupLoading, setLookupLoading] = useState(false);

  function stopTracks() {
    try {
      const v = videoRef.current;
      v?.srcObject && (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      if (v) v.srcObject = null;
    } catch {}
  }

  useEffect(() => {
    let mounted = true;

    async function startScanner() {
      if (!isOpen) return;
      if (typeof navigator === "undefined" || !navigator.mediaDevices) {
        setHasCamera(false);
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((d) => d.kind === "videoinput");
        if (!cameras.length) {
          setHasCamera(false);
          return;
        }
        setScanning(true);
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        codeReaderRef.current = reader;

        const constraints: MediaStreamConstraints = {
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          async (result /* , err */) => {
            if (!mounted) return;
            if (result && !scannedOnce.current) {
              scannedOnce.current = true;
              const code = result.getText();
              try {
                setLookupLoading(true);
                const found = await onLookupBarcode(code);
                if (!found) {
                  setScanError("No product found for this barcode. You can add a manual food.");
                } else {
                  onFoundFood(found);
                  onClose();
                }
              } catch {
                setScanError("Barcode lookup failed. Please try again or enter manually.");
              } finally {
                setLookupLoading(false);
              }
            }
          }
        );

        return () => {
          controls?.stop();
        };
      } catch (err: any) {
        console.error("[scanner] error:", err?.message || err);
        setScanError("Unable to access camera. You can enter the barcode manually.");
        setHasCamera(false);
        setScanning(false);
        stopTracks();
      }
    }

    const teardown = startScanner();
    return () => {
      (async () => {
        try {
          if (codeReaderRef.current) codeReaderRef.current.reset();
        } catch {}
        stopTracks();
        (await teardown)?.toString();
      })();
      mounted = false;
    };
  }, [isOpen]);

  async function lookupManualBarcode() {
    if (!barcodeInput || barcodeInput.trim().length < 6) {
      setScanError("Enter a valid barcode (at least 6 digits).");
      return;
    }
    try {
      setLookupLoading(true);
      const found = await onLookupBarcode(barcodeInput.trim());
      if (!found) {
        setScanError("No product found for this barcode. You can add a manual food.");
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
          <button className="btn btn-bxkr-outline" onClick={onClose}>
            Close
          </button>
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

            {scanError && <div className="mt-2 text-danger">{scanError}</div>}
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
            {scanError && <div className="mt-2 text-danger">{scanError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
