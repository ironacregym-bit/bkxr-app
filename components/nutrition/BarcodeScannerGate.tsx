
"use client";

import React from "react";

export default function BarcodeScannerGate({
  isPremium,
  onScanRequested,
}: {
  isPremium: boolean;
  onScanRequested: () => void;
}) {
  if (!isPremium) {
    return (
      <div className="futuristic-card p-3 mb-2">
        <div className="d-flex align-items-center justify-content-between">
          <div>
            <div className="fw-bold">Barcode scanner</div>
            <div className="small text-dim">Premium feature — unlock with 14‑day free trial or member code.</div>
          </div>
          <button className="btn btn-bxkr-outline" disabled title="Premium required">
            <i className="fas fa-lock me-1" /> Locked
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="futuristic-card p-3 mb-2">
      <div className="d-flex align-items-center justify-content-between">
        <div className="fw-bold">Barcode scanner</div>
        <button className="btn btn-bxkr" onClick={onScanRequested}>
          Scan barcode
        </button>
      </div>
    </div>
  );
}
