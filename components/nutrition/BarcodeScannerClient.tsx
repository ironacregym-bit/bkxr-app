"use client";"use client/nutrition/BarcodeScannerClient.tsx

import React, { useEffect, useRef, useState } from "react";
import type { Food } from "./FoodEditor";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onFoundFood: (food: Food) => void;
  onLookupBarcode: (code: string) => Promise<Food | undefined>;
};

function digits(s: string) {
  return String(s || "").replace(/\D/g, "");
}

export default function BarcodeScannerClient({
  isOpen,
  onClose,
  onFoundFood,
  onLookupBarcode,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<any>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  const scannedLockRef = useRef(false);

  const [scanError, setScanError] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [restartTick, setRestartTick] = useState(0);

  // Quick-add inline state
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickBusy, setQuickBusy] = useState(false);
  const [quickMsg, setQuickMsg] = useState<string | null>(null);
  const [quickForm, setQuickForm] = useState({
    code: "",
    name: "",
    brand: "",
    servingSize: "",
    image: "",
    calories: "" as number | string,
    protein: "" as number | string,
    carbs: "" as number | string,
    fat: "" as number | string,
  });

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
    try {
      controlsRef.current?.stop?.();
    } catch {}
    try {
      readerRef.current?.reset?.();
    } catch {}
    stopTracks();
  }

  async function startScanner(mountedRef: { current: boolean }) {
    setScanError(null);
    scannedLockRef.current = false;

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

      const devices = await BrowserMultiFormatReader.listVideoInputDevices();
      if (!devices || devices.length === 0) {
        setHasCamera(false);
        return;
      }

      const backLike = devices.find((d) => /back|rear|environment/i.test(d.label || ""));
      const chosen = backLike || devices[devices.length - 1];

      const controls = await reader.decodeFromVideoDevice(
        chosen.deviceId,
        videoRef.current!,
        async (result) => {
          if (!mountedRef.current) return;
          if (!result) return;
          if (scannedLockRef.current) return;

          scannedLockRef.current = true;

          const raw = result.getText();
          const code = digits(raw);

          if (!code || code.length < 6) {
            scannedLockRef.current = false;
            return;
          }

          try {
            setLookupLoading(true);
            const found = await onLookupBarcode(code);

            if (!found) {
              setScanError("No product found for this barcode.");
              setQuickForm((f) => ({
                ...f,
                code,
                name: "",
                brand: "",
                servingSize: "",
                image: "",
                calories: "",
                protein: "",
                carbs: "",
                fat: "",
              }));
              setQuickOpen(true);
              return;
            }

            onFoundFood(found);
            onClose();
          } catch {
            setScanError("Barcode lookup failed. Please try again or enter manually.");
            scannedLockRef.current = false;
          } finally {
            setLookupLoading(false);
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
      await teardown();
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
      } else if (document.visibilityState === "visible" && mountedRef.current && !quickOpen) {
        setRestartTick((t) => t + 1);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, restartTick]);

  useEffect(() => {
    if (quickOpen) {
      teardown();
    } else if (isOpen) {
      setRestartTick((t) => t + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickOpen]);

  async function lookupManualBarcode() {
    const code = digits(barcodeInput);
    if (!code || code.length < 6) {
      setScanError("Enter a valid barcode (at least 6 digits).");
      return;
    }

    try {
      setLookupLoading(true);
      scannedLockRef.current = true;

      const found = await onLookupBarcode(code);
      if (!found) {
        setScanError("No product found for this barcode.");
        setQuickForm((f) => ({ ...f, code }));
        setQuickOpen(true);
      } else {
        onFoundFood(found);
        onClose();
      }
    } finally {
      setLookupLoading(false);
    }
  }

  async function saveQuickAdd(e?: React.FormEvent) {
    e?.preventDefault();
    setQuickMsg(null);

    const payload = {
      code: digits(quickForm.code),
      name: String(quickForm.name || "").trim(),
      brand: String(quickForm.brand || "").trim(),
      image: quickForm.image ? String(quickForm.image) : null,
      servingSize: quickForm.servingSize ? String(quickForm.servingSize) : null,
      calories: Number(quickForm.calories) || 0,
      protein: Number(quickForm.protein) || 0,
      carbs: Number(quickForm.carbs) || 0,
      fat: Number(quickForm.fat) || 0,
    };

    if (!payload.code || !payload.name) {
      setQuickMsg("Barcode and name are required.");
      return;
    }

    setQuickBusy(true);

    try {
      const res = await fetch("/api/foods/upsert-barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to save");

      const food: Food =
        json.food || ({
          id: payload.code,
          code: payload.code,
          name: payload.name,
          brand: payload.brand || "",
          image: payload.image,
          calories: payload.calories,
          protein: payload.protein,
          carbs: payload.carbs,
          fat: payload.fat,
          servingSize: payload.servingSize || "",
          caloriesPerServing: null as any,
          proteinPerServing: null as any,
          carbsPerServing: null as any,
          fatPerServing: null as any,
        } as Food);

      onFoundFood(food);
      onClose();
    } catch (err: any) {
      setQuickMsg(err?.message || "Failed to save item");
    } finally {
      setQuickBusy(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="bxkr-modal">
      <div className="bxkr-modal-backdrop" onClick={onClose} />

      {/* Iron Acre modal surface */}
      <div
        className="bxkr-modal-dialog ia-tile ia-tile-pad"
        role="dialog"
        aria-modal="true"
        aria-label="Barcode scanner"
        style={{ maxWidth: 560 }}
      >
        <div style={{ maxHeight: "80vh", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="ia-tile-title">Scan barcode</div>

            <div className="d-flex gap-2">
              {!quickOpen && (
                <button
                  type="button"
                  className="ia-btn ia-btn-outline"
                  onClick={() => setRestartTick((t) => t + 1)}
                  title="Restart camera"
                >
                  Restart
                </button>
              )}
              <button type="button" className="ia-btn ia-btn-outline" onClick={onClose}>
                Close
              </button>
            </div>
          </div>

          {quickOpen ? (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="ia-tile-title">Add barcode item</div>
                <button
                  type="button"
                  className="ia-btn ia-btn-outline"
                  onClick={() => {
                    setQuickOpen(false);
                    setScanError(null);
                    scannedLockRef.current = false;
                  }}
                  title="Back to scanner"
                >
                  ← Back
                </button>
              </div>

              {quickMsg ? (
                <div className={`alert ${quickMsg.toLowerCase().includes("fail") ? "alert-danger" : "alert-info"} py-2`}>
                  {quickMsg}
                </div>
              ) : null}

              <form onSubmit={saveQuickAdd}>
                <div className="row g-2">
                  <div className="col-12 col-md-6">
                    <label className="form-label small text-dim mb-1">Barcode</label>
                    <input
                      className="form-control"
                      value={quickForm.code}
                      onChange={(e) => setQuickForm((f) => ({ ...f, code: digits(e.target.value) }))}
                      inputMode="numeric"
                      placeholder="digits only"
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small text-dim mb-1">Name</label>
                    <input
                      className="form-control"
                      value={quickForm.name}
                      onChange={(e) => setQuickForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Protein Bar – Peanut"
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small text-dim mb-1">Brand (optional)</label>
                    <input
                      className="form-control"
                      value={quickForm.brand}
                      onChange={(e) => setQuickForm((f) => ({ ...f, brand: e.target.value }))}
                      placeholder="e.g. Grenade"
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small text-dim mb-1">Serving (optional)</label>
                    <input
                      className="form-control"
                      value={quickForm.servingSize}
                      onChange={(e) => setQuickForm((f) => ({ ...f, servingSize: e.target.value }))}
                      placeholder="e.g. 1 bar (45g) or 45g"
                    />
                    <div className="small text-dim mt-1">
                      Tip: include grams like <span style={{ color: "var(--ia-neon)" }}>30g</span> to avoid 100g-only behaviour.
                    </div>
                  </div>

                  <div className="col-12">
                    <label className="form-label small text-dim mb-1">Image URL (optional)</label>
                    <input
                      className="form-control"
                      value={quickForm.image}
                      onChange={(e) => setQuickForm((f) => ({ ...f, image: e.target.value }))}
                      placeholder="https://…"
                    />
                  </div>

                  <div className="col-6 col-md-3">
                    <label className="form-label small text-dim mb-1">Calories</label>
                    <input
                      className="form-control"
                      type="number"
                      inputMode="decimal"
                      value={quickForm.calories}
                      onChange={(e) => setQuickForm((f) => ({ ...f, calories: e.target.value }))}
                    />
                  </div>

                  <div className="col-6 col-md-3">
                    <label className="form-label small text-dim mb-1">Protein (g)</label>
                    <input
                      className="form-control"
                      type="number"
                      inputMode="decimal"
                      value={quickForm.protein}
                      onChange={(e) => setQuickForm((f) => ({ ...f, protein: e.target.value }))}
                    />
                  </div>

                  <div className="col-6 col-md-3">
                    <label className="form-label small text-dim mb-1">Carbs (g)</label>
                    <input
                      className="form-control"
                      type="number"
                      inputMode="decimal"
                      value={quickForm.carbs}
                      onChange={(e) => setQuickForm((f) => ({ ...f, carbs: e.target.value }))}
                    />
                  </div>

                  <div className="col-6 col-md-3">
                    <label className="form-label small text-dim mb-1">Fat (g)</label>
                    <input
                      className="form-control"
                      type="number"
                      inputMode="decimal"
                      value={quickForm.fat}
                      onChange={(e) => setQuickForm((f) => ({ ...f, fat: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-3">
                  <button
                    type="button"
                    className="ia-btn ia-btn-outline"
                    onClick={() => setQuickOpen(false)}
                    disabled={quickBusy}
                  >
                    Cancel
                  </button>

                  <button type="submit" className="ia-btn ia-btn-primary" disabled={quickBusy}>
                    {quickBusy ? "Saving…" : "Save & use"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div>
              {hasCamera ? (
                <>
                  <div
                    className="mb-2"
                    style={{
                      position: "relative",
                      borderRadius: 16,
                      overflow: "hidden",
                      background: "rgba(0,0,0,0.4)",
                      height: 280,
                    }}
                  >
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />

                    {/* Scan frame */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 22,
                        borderRadius: 14,
                        border: "2px solid rgba(24,255,154,0.55)",
                        boxShadow: "0 0 20px rgba(24,255,154,0.18)",
                        pointerEvents: "none",
                      }}
                    />

                    <div
                      className="text-dim small"
                      style={{
                        position: "absolute",
                        left: 12,
                        right: 12,
                        bottom: 10,
                        textAlign: "center",
                        padding: "6px 10px",
                        borderRadius: 999,
                        background: "rgba(0,0,0,0.35)",
                      }}
                    >
                      Align the barcode within the frame. {lookupLoading ? "Looking up…" : scanning ? "Scanning…" : "Ready"}
                    </div>
                  </div>

                  <div className="d-flex gap-2">
                    <input
                      className="form-control"
                      placeholder="Enter barcode (optional)"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      inputMode="numeric"
                    />
                    <button
                      type="button"
                      className="ia-btn ia-btn-outline"
                      onClick={lookupManualBarcode}
                      disabled={lookupLoading}
                      title="Lookup barcode"
                    >
                      {lookupLoading ? "Looking up…" : "Lookup"}
                    </button>
                  </div>

                  {scanError ? (
                    <div className="mt-2">
                      <div className="text-danger">{scanError}</div>
                      <button
                        type="button"
                        className="ia-btn ia-btn-outline mt-2"
                        onClick={() => {
                          setQuickOpen(true);
                          setQuickMsg(null);
                          setQuickForm((f) => ({ ...f, code: digits(barcodeInput) }));
                        }}
                      >
                        + Add manually
                      </button>
                    </div>
                  ) : null}
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
                    <button type="button" className="ia-btn ia-btn-outline" onClick={lookupManualBarcode} disabled={lookupLoading}>
                      {lookupLoading ? "Looking up…" : "Lookup"}
                    </button>
                  </div>

                  {scanError ? <div className="mt-2 text-danger">{scanError}</div> : null}

                  <button
                    type="button"
                    className="ia-btn ia-btn-outline mt-2"
                    onClick={() => setQuickOpen(true)}
                  >
                    + Add manually
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
