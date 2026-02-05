"use client";

import React, { useMemo, useState, useEffect } from "react";

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
  calories: number;            // manual mode: total calories user enters; non-manual: used for per-100g baseline if present
  protein: number;             // grams
  carbs: number;               // grams
  fat: number;                 // grams
  servingSize?: string | null; // e.g., "45g" or "1 cup (200g)"; we’ll try to parse grams if present
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
  onCancel, // allow closing the editor
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
  onCancel?: () => void;
}) {
  const manualMode = useMemo(
    () => food.id?.startsWith("manual-") || (!food.code && !food.name),
    [food]
  );

  const onSelectAll: React.FocusEventHandler<HTMLInputElement> = (e) => {
    try {
      e.currentTarget.select();
    } catch {}
  };

  /* ---------------- Manual mode: macros directly editable ---------------- */
  if (manualMode) {
    return (
      <div className="futuristic-card p-3" style={{ scrollMarginTop: 12 }}>
        {/* Header row with cancel + favourite */}
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="fw-semibold">Add item</div>
          <div className="d-flex align-items-center" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-sm btn-outline-light"
              onClick={onToggleFavourite}
              title={isFavourite ? "Unfavourite" : "Favourite"}
              style={{ borderRadius: 999 }}
            >
              <i className={isFavourite ? "fas fa-star text-warning" : "far fa-star"} />
            </button>
            {onCancel && (
              <button
                type="button"
                className="btn btn-sm btn-outline-light"
                onClick={onCancel}
                aria-label="Cancel"
                style={{ borderRadius: 999 }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

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
            disabled={
              Number(food.calories) <= 0 &&
              Number(food.protein) <= 0 &&
              Number(food.carbs) <= 0 &&
              Number(food.fat) <= 0
            }
          >
            Add to {meal}
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- Non-manual mode: grams -> auto-calc macros ---------------- */

  // Try to parse grams from servingSize if present, e.g., "45g", "1 cup (200g)"
  function parseServingGrams(s?: string | null): number | null {
    if (!s) return null;
    // Find the first number followed by 'g'
    const match = s.match(/(\d+(\.\d+)?)\s*g/i);
    if (match) {
      const n = Number(match[1]);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return null;
  }

  // per-100g baseline (common for scanned items)
  const hasPer100 =
    Number.isFinite(food.calories) ||
    Number.isFinite(food.protein) ||
    Number.isFinite(food.carbs) ||
    Number.isFinite(food.fat);

  const servingG = parseServingGrams(food.servingSize);
  const hasPerServing =
    food.caloriesPerServing != null ||
    food.proteinPerServing != null ||
    food.carbsPerServing != null ||
    food.fatPerServing != null;

  // grams state (how much the user ate)
  const [grams, setGrams] = useState<number>(100);

  // auto-pick sensible default grams: prefer parsed serving grams; else 100g
  useEffect(() => {
    if (servingG && servingG > 0) {
      setGrams(servingG);
    } else {
      setGrams(100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [food.id]);

  // Compute macros from grams:
  // - If per-100g is available -> perGram = per100 / 100
  // - Else if per-serving + serving grams parseable -> perGram = perServing / servingG
  // - Else (no way to convert to per-gram) -> fall back to per-serving and treat grams as 1 serving if grams > 0
  function calcFromGrams(g: number) {
    const safeG = Math.max(0, g || 0);
    if (hasPer100) {
      const perGram = {
        cal: Number(food.calories || 0) / 100,
        p: Number(food.protein || 0) / 100,
        c: Number(food.carbs || 0) / 100,
        f: Number(food.fat || 0) / 100,
      };
      return {
        calories: +(perGram.cal * safeG).toFixed(2),
        protein: +(perGram.p * safeG).toFixed(2),
        carbs: +(perGram.c * safeG).toFixed(2),
        fat: +(perGram.f * safeG).toFixed(2),
      };
    }

    if (hasPerServing && servingG && servingG > 0) {
      const perGram = {
        cal: Number(food.caloriesPerServing || 0) / servingG,
        p: Number(food.proteinPerServing || 0) / servingG,
        c: Number(food.carbsPerServing || 0) / servingG,
        f: Number(food.fatPerServing || 0) / servingG,
      };
      return {
        calories: +(perGram.cal * safeG).toFixed(2),
        protein: +(perGram.p * safeG).toFixed(2),
        carbs: +(perGram.c * safeG).toFixed(2),
        fat: +(perGram.f * safeG).toFixed(2),
      };
    }

    // Last resort: no per-gram path; interpret any positive grams as "1 serving"
    if (hasPerServing) {
      const multiplier = safeG > 0 ? 1 : 0;
      return {
        calories: +(Number(food.caloriesPerServing || 0) * multiplier).toFixed(2),
        protein: +(Number(food.proteinPerServing || 0) * multiplier).toFixed(2),
        carbs: +(Number(food.carbsPerServing || 0) * multiplier).toFixed(2),
        fat: +(Number(food.fatPerServing || 0) * multiplier).toFixed(2),
      };
    }

    // No data; all zero
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  const derived = calcFromGrams(grams);

  // Build a Food payload with the calculated macros to ensure addEntry uses *these* numbers
  const foodForSave: Food = {
    ...food,
    calories: derived.calories,
    protein: derived.protein,
    carbs: derived.carbs,
    fat: derived.fat,
  };

  return (
    <div className="futuristic-card p-3" style={{ scrollMarginTop: 12 }}>
      {/* Header row */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="fw-semibold" style={{ lineHeight: 1.1 }}>
          {food.name || food.code || "Food"}
        </div>
        <div className="d-flex align-items-center" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn btn-sm btn-outline-light"
            onClick={onToggleFavourite}
            title={isFavourite ? "Unfavourite" : "Favourite"}
            style={{ borderRadius: 999 }}
          >
            <i className={isFavourite ? "fas fa-star text-warning" : "far fa-star"} />
          </button>
          {onCancel && (
            <button
              type="button"
              className="btn btn-sm btn-outline-light"
              onClick={onCancel}
              aria-label="Cancel"
              style={{ borderRadius: 999 }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Amount (grams) */}
      <div className="row g-2">
        <div className="col-12 col-md-4">
          <label className="form-label small text-dim mb-1">Amount (grams)</label>
          <input
            type="number"
            className="form-control"
            inputMode="decimal"
            min={0}
            value={Number.isFinite(grams) ? grams : 0}
            onChange={(e) => setGrams(Math.max(0, Number(e.target.value || 0)))}
            onFocus={onSelectAll}
            placeholder={servingG ? `${servingG} g` : "e.g., 75"}
          />
          {servingG ? (
            <div className="small text-dim mt-1">Typical serving ≈ {servingG} g</div>
          ) : hasPerServing ? (
            <div className="small text-dim mt-1">Using per serving values (serving grams unknown)</div>
          ) : (
            <div className="small text-dim mt-1">Using per 100 g baseline</div>
          )}
        </div>
      </div>

      {/* Calculated macros preview */}
      <div className="d-flex justify-content-between small my-2">
        <span style={{ color: COLORS.calories }}>{round2(derived.calories)} kcal</span>
        <span style={{ color: COLORS.protein }}>{round2(derived.protein)}p</span>
        <span style={{ color: COLORS.carbs }}>{round2(derived.carbs)}c</span>
        <span style={{ color: COLORS.fat }}>{round2(derived.fat)}f</span>
      </div>

      <div className="d-flex gap-2">
        <button
          className="btn btn-bxkr w-100"
          onClick={() => addEntry(meal, foodForSave)}
          disabled={
            Number(derived.calories) <= 0 &&
            Number(derived.protein) <= 0 &&
            Number(derived.carbs) <= 0 &&
            Number(derived.fat) <= 0
          }
        >
          Add to {meal}
        </button>
      </div>
    </div>
  );
}
