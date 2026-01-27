
"use client";

import React, { useEffect } from "react";

const COLORS = {
  calories: "#ff7f32",
  protein: "#32ff7f",
  carbs: "#ffc107",
  fat: "#ff4fa3",
};

function round2(n: number | undefined | null): string {
  return n !== undefined && n !== null ? Number(n).toFixed(2) : "-";
}

export type Food = {
  id: string;
  code: string;
  name: string;
  brand: string;
  image: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize?: string | null;          // e.g. "1 egg (60g)"
  caloriesPerServing?: number | null;
  proteinPerServing?: number | null;
  carbsPerServing?: number | null;
  fatPerServing?: number | null;
};

export default function FoodEditor({
  meal,
  food,
  grams,
  setGrams,
  usingServing,
  setUsingServing,
  scaledSelected,
  addEntry,
  isFavourite,
  onToggleFavourite,
}: {
  meal: string;
  food: Food;
  grams: number;
  setGrams: (v: number) => void;
  usingServing: "per100" | "serving";
  setUsingServing: (v: "per100" | "serving") => void;
  scaledSelected: Food | null;
  addEntry: (meal: string, food: Food) => void;
  isFavourite: boolean;
  onToggleFavourite: () => void;
}) {

  const hasServing = !!food.servingSize;
  const servingLabel = hasServing ? `1 serving (${food.servingSize})` : undefined;

  // ---------- NEW: auto-load serving by default ----------
  useEffect(() => {
    if (!hasServing) return;

    const match =
      (food.servingSize || "").match(/(\d+(?:\.\d+)?)\s*g/i) ||
      (food.servingSize || "").match(/\((\d+(?:\.\d+)?)\s*g\)/i);

    const gramsFromServing = match && match[1] ? Number(match[1]) : null;

    if (gramsFromServing != null) {
      setUsingServing("serving");
      setGrams(gramsFromServing);
    }
  }, [food.servingSize, hasServing, setGrams, setUsingServing]);

  return (
    <div className="futuristic-card p-3">
      {/* Amount row */}
      <div className="row g-2 align-items-center mb-2">
        <div className={hasServing ? "col-6" : "col-12"}>
          <label className="form-label small text-dim mb-1">Grams</label>
          <input
            type="number"
            className="form-control"
            value={grams}
            onChange={(e) => {
              const v = Number(e.target.value);
              setUsingServing("per100");
              setGrams(Number.isFinite(v) ? Math.max(0, v) : 0);
            }}
          />
        </div>

        {hasServing && (
          <div className="col-6">
            <label className="form-label small text-dim mb-1">Amount</label>
            <select
              className="form-select"
              value={usingServing}
              onChange={(e) => {
                const mode = e.target.value === "serving" ? "serving" : "per100";
                setUsingServing(mode);

                if (mode === "serving") {
                  const match =
                    (food.servingSize || "").match(/(\d+(?:\.\d+)?)\s*g/i) ||
                    (food.servingSize || "").match(/\((\d+(?:\.\d+)?)\s*g\)/i);
                  const gramsFromServing = match && match[1] ? Number(match[1]) : null;
                  if (gramsFromServing != null) setGrams(gramsFromServing);
                }
              }}
            >
              <option value="per100">Per 100 g</option>
              <option value="serving">{servingLabel}</option>
            </select>
          </div>
        )}
      </div>

      {/* Macro preview */}
      <div className="d-flex justify-content-between small mb-2">
        <span style={{ color: COLORS.calories }}>{round2(scaledSelected?.calories)} kcal</span>
        <span style={{ color: COLORS.protein }}>{round2(scaledSelected?.protein)}p</span>
        <span style={{ color: COLORS.carbs }}>{round2(scaledSelected?.carbs)}c</span>
        <span style={{ color: COLORS.fat }}>{round2(scaledSelected?.fat)}f</span>
      </div>

      <div className="d-flex gap-2 mb-2">
        <button className="btn btn-bxkr w-100" onClick={() => addEntry(meal, scaledSelected || food)}>
          Add to {meal}
        </button>
        <button
          type="button"
          className="btn btn-bxkr-outline"
          onClick={onToggleFavourite}
          title={isFavourite ? "Unfavourite" : "Favourite"}
        >
          <i className={isFavourite ? "fas fa-star text-warning" : "far fa-star"} />
        </button>
      </div>

      <div className="fw-bold">
        {food.name} ({food.brand}) — {round2(food.calories)} kcal/100g
      </div>

      {hasServing && (
        <div className="small text-dim">
          Serving: {food.servingSize}
          {food.caloriesPerServing != null &&
            ` — ${round2(food.caloriesPerServing)} kcal/serving`}
        </div>
      )}
    </div>
  );
}
