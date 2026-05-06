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

function fmt1(n: number | undefined | null) {
  return Number.isFinite(Number(n)) ? String(Number(n).toFixed(0)) : "-";
}

function MiniRing({
  label,
  color,
  valuePct,
  valueText,
}: {
  label: string;
  color: string;
  valuePct: number;
  valueText: string;
}) {
  return (
    <div className="d-flex align-items-center" style={{ gap: 10 }}>
      <div style={{ width: 44, height: 44 }}>
        <CircularProgressbar
          value={clampPct(valuePct)}
          strokeWidth={10}
          styles={buildStyles({
            pathColor: color,
            trailColor: "rgba(255,255,255,0.08)",
            strokeLinecap: "round",
            pathTransitionDuration: 0.4,
          })}
        />
      </div>
      <div style={{ lineHeight: 1.1 }}>
        <div className="small text-dim">{label}</div>
        <div className="fw-semibold">{valueText}</div>
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
  const calTextTop = fmt0(totals.calories);
  const calTextBottom = `${fmt0(goals.calories)} cal`;

  return (
    <section className="futuristic-card p-3 mb-3">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <div>
          <div className="text-dim small" style={{ letterSpacing: 0.6, textTransform: "uppercase" }}>
            Today’s progress
          </div>
        </div>
        <div className="text-dim small">{/* optional date label handled by page */}</div>
      </div>

      <div className="row g-3 align-items-center">
        {/* Big calories ring */}
        <div className="col-12 col-md-6">
          <div className="d-flex justify-content-center justify-content-md-start">
            <div style={{ width: 150, height: 150, position: "relative" }}>
              <CircularProgressbar
                value={clampPct(progress.calories)}
                strokeWidth={10}
                styles={buildStyles({
                  pathColor: COLORS.calories,
                  trailColor: "rgba(255,255,255,0.08)",
                  strokeLinecap: "round",
                  pathTransitionDuration: 0.5,
                })}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                <div className="fw-bold" style={{ fontSize: 28, lineHeight: 1 }}>
                  {calTextTop}
                </div>
                <div className="text-dim small" style={{ marginTop: 2 }}>
                  / {calTextBottom}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mini rings */}
        <div className="col-12 col-md-6">
          <div className="d-flex flex-column" style={{ gap: 12 }}>
            <MiniRing
              label="Protein"
              color={COLORS.protein}
              valuePct={progress.protein}
              valueText={`${fmt1(totals.protein)} / ${fmt1(goals.protein)}g`}
            />
            <MiniRing
              label="Carbs"
              color={COLORS.carbs}
              valuePct={progress.carbs}
              valueText={`${fmt1(totals.carbs)} / ${fmt1(goals.carbs)}g`}
            />
            <MiniRing
              label="Fat"
              color={COLORS.fat}
              valuePct={progress.fat}
              valueText={`${fmt1(totals.fat)} / ${fmt1(goals.fat)}g`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
