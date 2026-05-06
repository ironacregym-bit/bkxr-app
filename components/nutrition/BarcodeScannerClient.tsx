// File: components/nutrition/BarcodeScannerClient.tsx
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
  const scanningRef = useRef(false);

  const [status, setStatus] = useState<
    "idle" | "scanning" | "found" | "not_found" | "error"
  >("idle");
  const [message, setMessage] = useState<string>("Align barcode in the frame");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);

  function stopAll() {
    try {
      controlsRef.current?.stop?.();
    } catch {}
    try {
      readerRef.current?.reset?.();
    } catch {}
    try {
      const v = videoRef.current;
      if (v?.srcObject) {
        (v.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        v.srcObject = null;
      }
    } catch {}
  }

  async function startScanner(mounted: { current: boolean }) {
    setStatus("scanning");
    setMessage("Align barcode in the frame");
    scanningRef.current = false;

    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      if (!devices?.length) {
        setStatus("error");
        setMessage("Camera not available");
        return;
      }

      const backCam =
        devices.find((d) => /back|rear|environment/i.test(d.label)) ||
        devices[devices.length - 1];

      const controls = await reader.decodeFromVideoDevice(
        backCam.deviceId,
        videoRef.current!,
        async (result) => {
          if (!mounted.current) return;
          if (!result || scanningRef.current) return;

          scanningRef.current = true;
          const code = result.getText();

          setMessage("Looking up product…");

          try {
            const food = await onLookupBarcode(code);
            if (!food) {
              setStatus("not_found");
              setMessage("No product found");
              return;
            }

            setStatus("found");
            setMessage("Found ✓");

            setTimeout(() => {
              onFoundFood(food);
              onClose();
            }, 400);
          } catch {
            setStatus("error");
            setMessage("Lookup failed");
          }
        }
      );

      controlsRef.current = controls;
    } catch (err) {
      setStatus("error");
      setMessage("Unable to start camera");
    }
  }

  useEffect(() => {
    if (!isOpen) return;

    const mounted = { current: true };
    startScanner(mounted);

    return () => {
      mounted.current = false;
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  async function lookupManual() {
    const code = barcodeInput.trim();
    if (code.length < 6) return;

    setLookupBusy(true);
    setMessage("Looking up product…");

    try {
      const food = await onLookupBarcode(code);
      if (!food) {
        setStatus("not_found");
        setMessage("No product found");
        return;
      }
      onFoundFood(food);
      onClose();
    } catch {
      setStatus("error");
      setMessage("Lookup failed");
    } finally {
      setLookupBusy(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="bxkr-modal">
      <div className="bxkr-modal-backdrop" onClick={onClose} />

      <div
        className="bxkr-modal-dialog futuristic-card"
        role="dialog"
        aria-modal="true"
        aria-label="Scan barcode"
        style={{ maxWidth: 420 }}
      >
        <div className="p-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="fw-bold">Scan barcode</div>
            <button
              className="btn btn-sm btn-outline-light"
              onClick={onClose}
              style={{ borderRadius: 999, minWidth: 40, minHeight: 40 }}
            >
              ✕
            </button>
          </div>

          {/* Camera view */}
          <div
            style={{
              position: "relative",
              borderRadius: 16,
              overflow: "hidden",
              background: "#000",
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%", height: 240, objectFit: "cover" }}
            />

            {/* Scan frame */}
            <div
              style={{
                position: "absolute",
                inset: 20,
                border: "2px solid rgba(255,255,255,0.5)",
                borderRadius: 12,
              }}
            />
          </div>

          {/* Status text */}
          <div
            className="text-center text-dim mt-2"
            style={{ minHeight: 22 }}
          >
            {message}
          </div>

          {/* Manual fallback */}
          {(status === "not_found" || status === "error") && (
            <div className="mt-3">
              <div className="text-dim small mb-1">
                Enter barcode manually
              </div>
              <div className="d-flex gap-2">
                <input
                  className="form-control"
                  placeholder="e.g. 5051234567890"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  inputMode="numeric"
                />
                <button
                  className="btn btn-bxkr"
                  onClick={lookupManual}
                  disabled={lookupBusy}
                >
                  Lookup
                </button>
              </div>
            </div>
          )}

          {/* Quick add fallback */}
          {status === "not_found" && (
            <button
              className="btn btn-sm btn-outline-light mt-3 w-100"
              onClick={() => {
                onFoundFood({
                  id: `manual-${Date.now()}`,
                  code: barcodeInput,
                  name: "",
                  brand: "",
                  image: null,
                  calories: 0,
                  protein: 0,
                  carbs: 0,
                  fat: 0,
                } as Food);
                onClose();
              }}
            >
              + Add manually
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
