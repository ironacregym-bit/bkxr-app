"use client";

import React, { useMemo } from "react";

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
  brand: string;               // kept for shape; not shown in manual mode
  image: string | null;
  calories: number;            // now: total calories user enters (manual mode)
  protein: number;             // total g
  carbs: number;               // total g
  fat: number;                 // total g
  servingSize?: string | null; // kept for shape; not shown in manual mode
  caloriesPerServing?: number | null;
  proteinPerServing?: number | null;
  carbsPerServing?: number | null;
  fatPerServing?: number | null;
};

export default function FoodEditor({
  meal,
  food,
  usingServing,
  setUsingServing,
  scaledSelected,
  addEntry,
  isFavourite,
  onToggleFavourite,
  onChangeFood,
}: {
  meal: string;
  food: Food;
  usingServing: "per100" | "serving";
  setUsingServing: (v: "per100" | "serving") => void;
  scaledSelected: Food | null;
  addEntry: (meal: string, food: Food) => void;
  isFavourite: boolean;
  onToggleFavourite: () => void;
  onChangeFood: (patch: Partial<Food>) => void;
}) {
  const manualMode = useMemo(() => food.id?.startsWith("manual-") || (!food.code && !food.name), [food]);

  const onSelectAll: React.FocusEventHandler<HTMLInputElement> = (e) => {
    try { e.currentTarget.select(); } catch {}
  };

  // Manual mode: just Name (optional) + macros
  if (manualMode) {
    return (
      <div className="futuristic-card p-3">
        <div className="mb-2">
          <label className="form-label small text-dim mb-1">Name (optional)</label>
          <input
            type="text"
            className="form-control"
            placeholder="e.g. Lunch meal total"
            value={food.name || ""}
            onChange={(e) => onChangeFood({ name: e.target.value })}
          />
        </div>

        <div className="row g-2">
          <div className="col-6 col-md-3">
            <label className="form-label small text-dim mb-1">Calories</label>
            <input
              type="number"
              className="form-control"
              inputMode="decimal"
              value={Number.isFinite(food.calories) ? food.calories : 0}
              onChange={(e) => onChangeFood({ calories: Math.max(0, Number(e.target.value || 0)) })}
              onFocus={onSelectAll}
              placeholder="kcal"
            />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small text-dim mb-1">Protein (g)</label>
            <input
              type="number"
              className="form-control"
              inputMode="decimal"
              value={Number.isFinite(food.protein) ? food.protein : 0}
              onChange={(e) => onChangeFood({ protein: Math.max(0, Number(e.target.value || 0)) })}
              onFocus={onSelectAll}
              placeholder="grams"
            />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small text-dim mb-1">Carbs (g)</label>
            <input
              type="number"
              className="form-control"
              inputMode="decimal"
              value={Number.isFinite(food.carbs) ? food.carbs : 0}
              onChange={(e) => onChangeFood({ carbs: Math.max(0, Number(e.target.value || 0)) })}
              onFocus={onSelectAll}
              placeholder="grams"
            />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small text-dim mb-1">Fat (g)</label>
            <input
              type="number"
              className="form-control"
              inputMode="decimal"
              value={Number.isFinite(food.fat) ? food.fat : 0}
              onChange={(e) => onChangeFood({ fat: Math.max(0, Number(e.target.value || 0)) })}
              onFocus={onSelectAll}
              placeholder="grams"
            />
          </div>
        </div>

        <div className="d-flex justify-content-between small my-2">
          <span style={{ color: COLORS.calories }}>{round2(food.calories)} kcal</span>
          <span style={{ color: COLORS.protein }}>{round2(food.protein)}p</span>
          <span style={{ color: COLORS.carbs }}>{round2(food.carbs)}c</span>
          <span style={{ color: COLORS.fat }}>{round2(food.fat)}f</span>
        </div>

        <div className="d-flex gap-2">
          <button
            className="btn btn-bxkr w-100"
            onClick={() => addEntry(meal, food)}
            disabled={Number(food.calories) <= 0 && Number(food.protein) <= 0 && Number(food.carbs) <= 0 && Number(food.fat) <= 0}
          >
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
      </div>
    );
  }

  // Non-manual (searched/scanned) — keep your existing compact viewer (no grams UI shown here)
  return (
    <div className="futuristic-card p-3">
      <div className="d-flex justify-content-between small mb-2">
        <span style={{ color: COLORS.calories }}>{round2(scaledSelected?.calories)} kcal</span>
        <span style={{ color: COLORS.protein }}>{round2(scaledSelected?.protein)}p</span>
        <span style={{ color: COLORS.carbs }}>{round2(scaledSelected?.carbs)}c</span>
        <span style={{ color: COLORS.fat }}>{round2(scaledSelected?.fat)}f</span>
      </div>

      <div className="d-flex gap-2 mb-2">
        <button
          className="btn btn-bxkr w-100"
          onClick={() => addEntry(meal, (scaledSelected || food) as Food)}
        >
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
        {food.name} — {round2(food.calories)} kcal
      </div>
    </div>
  );
}
