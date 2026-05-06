"use client";

// File: components/nutrition/BarcodeScannerGate.tsx

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
      <div
        className="d-flex align-items-center justify-content-between"
        style={{
          padding: "12px 12px",
          borderRadius: 14,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="fw-semibold">Barcode scanner</div>
          <div className="text-dim small" style={{ lineHeight: 1.2 }}>
            Premium feature — unlock with 14‑day free trial or member code.
          </div>
        </div>

        <button type="button" className="ia-btn ia-btn-outline" disabled title="Premium required">
          <i className="fas fa-lock me-1" /> Locked
        </button>
      </div>
    );
  }

  return (
    <div
      className="d-flex align-items-center justify-content-between"
      style={{
        padding: "12px 12px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="fw-semibold">Barcode scanner</div>

      <button type="button" className="ia-btn ia-btn-primary" onClick={onScanRequested}>
        Scan barcode
      </button>
    </div>
  );
}
