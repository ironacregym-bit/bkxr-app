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
    try { controlsRef.current?.stop?.(); } catch {}
    try { readerRef.current?.reset?.(); } catch {}
    stopTracks();
  }

  async function startScanner(mountedRef: { current: boolean }) {
    setScanError(null);
    setBarcodeInput("");
    setLastCode("");
    setQuickOpen(false);
    setQuickMsg(null);
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
        async (result /*, err */) => {
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
                // Prefill quick form for fastest add
                setQuickForm((f) => ({
                  ...f,
                  code: String(code || "").replace(/\D/g, ""),
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
                // allow another try without forcing restart
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
        setQuickForm((f) => ({
          ...f,
          code: String(code || "").replace(/\D/g, ""),
        }));
        setQuickOpen(true);
      } else {
        onFoundFood(found);
        onClose();
      }
    } finally {
      setLookupLoading(false);
    }
  }

  // ---- Quick add submit ----
  async function saveQuickAdd(e?: React.FormEvent) {
    e?.preventDefault();
    setQuickMsg(null);

    const payload = {
      scope: "user", // user-level by default; admin page handles global
      code: String(quickForm.code || "").replace(/\D/g, ""),
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

      // Return the saved food to the parent instantly
      const food: Food = json.food || {
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
      };

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

            {/* Manual entry row */}
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

            {/* Error + Quick-add CTA */}
            {scanError && (
              <div className="mt-2">
                <div className="text-danger">{scanError}</div>
                {!quickOpen && (
                  <button
                    className="btn btn-sm btn-bxkr-outline mt-2"
                    style={{ borderRadius: 24 }}
                    onClick={() => {
                      setQuickOpen(true);
                      setQuickMsg(null);
                      setQuickForm((f) => ({
                        ...f,
                        code: String(lastCode || barcodeInput || "").replace(/\D/g, ""),
                      }));
                    }}
                  >
                    + Quick add this barcode
                  </button>
                )}
              </div>
            )}

            {/* Inline Quick Add Form (no navigation) */}
            {quickOpen && (
              <div className="futuristic-card p-3 mt-3">
                <h6 className="m-0 mb-2">Add barcode item</h6>
                {quickMsg && <div className={`alert ${quickMsg.includes("Failed") ? "alert-danger" : "alert-info"} py-2`}>{quickMsg}</div>}

                <form onSubmit={saveQuickAdd}>
                  <div className="row g-2">
                    <div className="col-12 col-md-6">
                      <label className="form-label small text-dim mb-1">Barcode</label>
                      <input
                        className="form-control"
                        value={quickForm.code}
                        onChange={(e) => setQuickForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, "") }))}
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
                        placeholder="e.g. 1 bar (45g)"
                      />
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
                      className="btn btn-outline-light"
                      style={{ borderRadius: 24 }}
                      onClick={() => setQuickOpen(false)}
                      disabled={quickBusy}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-bxkr"
                      style={{ borderRadius: 24 }}
                      disabled={quickBusy}
                    >
                      {quickBusy ? "Saving…" : "Save & use"}
                    </button>
                  </div>
                </form>
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
            {scanError && !quickOpen && (
              <div className="mt-2">
                <div className="text-danger">{scanError}</div>
                <button
                  className="btn btn-sm btn-bxkr-outline mt-2"
                  style={{ borderRadius: 24 }}
                  onClick={() => setQuickOpen(true)}
                >
                  + Quick add this barcode
                </button>
              </div>
            )}
            {quickOpen && (
              // Reuse the same quick form block when no camera
              <div className="futuristic-card p-3 mt-3">
                <h6 className="m-0 mb-2">Add barcode item</h6>
                {quickMsg && <div className={`alert ${quickMsg.includes("Failed") ? "alert-danger" : "alert-info"} py-2`}>{quickMsg}</div>}
                <form onSubmit={saveQuickAdd}>
                  {/* Compact version uses the same fields */}
                  <div className="row g-2">
                    <div className="col-12 col-md-6">
                      <label className="form-label small text-dim mb-1">Barcode</label>
                      <input
                        className="form-control"
                        value={quickForm.code}
                        onChange={(e) => setQuickForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, "") }))}
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
                  </div>
                  <div className="row g-2 mt-1">
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
                    <button type="button" className="btn btn-outline-light" style={{ borderRadius: 24 }} onClick={() => setQuickOpen(false)} disabled={quickBusy}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-bxkr" style={{ borderRadius: 24 }} disabled={quickBusy}>
                      {quickBusy ? "Saving…" : "Save & use"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
