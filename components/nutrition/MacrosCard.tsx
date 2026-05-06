// File: components/nutrition/MacrosCard.tsx
"use client";

import React from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { NUTRITION_COLORS as COLORS } from "./nutritionTheme";

export type MacroTotals = { calories: number; protein: number; carbs: number; fat: number };
export type MacroGoals = { calories: number; protein: number; carbs: number; fat: number };
export type MacroProgress = { calories: number; protein: number; carbs: number; fat: number };

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}
function fmt0(n: number | undefined | null) {
  return Number.isFinite(Number(n)) ? String(Math.round(Number(n))) : "-";
}

function MiniRing({
  label,
  color,
  pct,
  valueText,
}: {
  label: string;
  color: string;
  pct: number;
  valueText: string;
}) {
  return (
    <div className="d-flex align-items-center" style={{ gap: 10 }}>
      <div style={{ width: 38, height: 38, flex: "0 0 auto" }}>
        <CircularProgressbar
          value={clampPct(pct)}
          strokeWidth={10}
          styles={buildStyles({
            pathColor: color,
            trailColor: "rgba(255,255,255,0.08)",
            strokeLinecap: "round",
            pathTransitionDuration: 0.35,
          })}
        />
      </div>

      <div style={{ lineHeight: 1.05, minWidth: 0 }}>
        <div className="ia-kicker" style={{ fontSize: 0.72 + "rem" }}>
          {label}
        </div>
        <div className="fw-semibold" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
          {valueText}
        </div>
      </div>
    </div>
  );
}

export default function MacrosCard({
  totals,
  goals,
  progress,
}: {
  totals: MacroTotals;
  goals: MacroGoals;
  progress: MacroProgress;
}) {
  return (
    <section className="ia-tile ia-tile-pad mb-3">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <div className="ia-kicker">Today’s progress</div>
      </div>

      {/* One row: calories ring + mini rings column */}
      <div className="d-flex align-items-center" style={{ gap: 14 }}>
