
"use client";

import React from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

const COLORS = {
  calories: "#ff7f32",
  protein: "#32ff7f",
  carbs: "#ffc107",
  fat: "#ff4fa3",
};

export type MacroTotals = { calories: number; protein: number; carbs: number; fat: number };
export type MacroGoals = { calories: number; protein: number; carbs: number; fat: number };
export type MacroProgress = { calories: number; protein: number; carbs: number; fat: number };

function round2(n: number | undefined | null) {
  return n !== undefined && n !== null ? Number(n).toFixed(2) : "-";
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
    <div className="row mb-4">
      <div className="col-6">
        <div className="futuristic-card p-3">
          <h5 className="mb-3">Macros</h5>
          <p style={{ color: COLORS.calories }}>
            Calories: {round2(totals.calories)} / {goals.calories}
          </p>
          <p style={{ color: COLORS.protein }}>
            Protein: {round2(totals.protein)} / {goals.protein} g
          </p>
          <p style={{ color: COLORS.carbs }}>
            Carbs: {round2(totals.carbs)} / {goals.carbs} g
          </p>
          <p style={{ color: COLORS.fat }}>
            Fat: {round2(totals.fat)} / {goals.fat} g
          </p>
        </div>
      </div>

      <div className="col-6 d-flex justify-content-center">
        <div style={{ position: "relative", width: 180, height: 180 }}>
          <div style={{ position: "absolute", top: 0, left: 0, width: 180, height: 180 }}>
            <CircularProgressbar
              value={progress.calories}
              strokeWidth={7}
              styles={buildStyles({
                pathColor: COLORS.calories,
                trailColor: "rgba(255,127,50,0.15)",
                strokeLinecap: "butt",
                pathTransitionDuration: 0.8,
              })}
            />
          </div>
          <div style={{ position: "absolute", top: 14, left: 14, width: 152, height: 152 }}>
            <CircularProgressbar
              value={progress.protein}
              strokeWidth={8}
              styles={buildStyles({
                pathColor: COLORS.protein,
                trailColor: "rgba(50,255,127,0.15)",
                strokeLinecap: "butt",
                pathTransitionDuration: 0.8,
              })}
            />
          </div>
          <div style={{ position: "absolute", top: 28, left: 28, width: 124, height: 124 }}>
            <CircularProgressbar
              value={progress.carbs}
              strokeWidth={10}
              styles={buildStyles({
                pathColor: COLORS.carbs,
                trailColor: "rgba(255,193,7,0.15)",
                strokeLinecap: "butt",
                pathTransitionDuration: 0.8,
              })}
            />
          </div>
          <div style={{ position: "absolute", top: 42, left: 42, width: 96, height: 96 }}>
            <CircularProgressbar
              value={progress.fat}
              strokeWidth={12}
              styles={buildStyles({
                pathColor: COLORS.fat,
                trailColor: "rgba(255,79,163,0.15)",
                strokeLinecap: "butt",
                pathTransitionDuration: 0.8,
              })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
