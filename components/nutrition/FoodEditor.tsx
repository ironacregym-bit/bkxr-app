"use client";

import React, { useEffect, useMemo } from "react";

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
  calories: number;              // per 100 g
  protein: number;               // per 100 g
  carbs: number;                 // per 100 g
  fat: number;                   // per 100 g
  servingSize?: string | null;   // e.g. "1 cup (240g)"
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
  onChangeFood,
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
  onChangeFood: (patch: Partial<Food>) => void;
}) {
  const hasServing = !!food.servingSize && String(food.servingSize).trim() !== "";
  const servingLabel = hasServing ? `1 serving (${food.servingSize})` : undefined;

  // Treat editor as "manual mode" if this came from the manual button (id starts with manual-)
  const manualMode = useMemo(() => food.id?.startsWith("manual-") || (!food.code && !food.name), [food]);

  // Select-all helper for numeric inputs (prevents "020")
  const onSelectAll: React.FocusEventHandler<HTMLInputElement> = (e) => {
    try { e.currentTarget.select(); } catch {}
  };

  // If a serving label includes grams, auto-switch to serving and set grams once
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
      {/* Manual details (name/brand/per-100g macros) */}
      {manualMode && (
        <div className="mb-3">
          <div className="row g-2">
            <div className="col-12 col-md-7">
              <label className="form-label small text-dim mb-1">Food name</label>
              <input
                type="text"
                className="form-control"
                value={food.name || ""}
                onChange={(e) => onChangeFood({ name: e.target.value })}
                placeholder="e.g. Oats, wholegrain"
              />
            </div>
            <div className="col-12 col-md-5">
              <label className="form-label small text-dim mb-1">Brand (optional)</label>
              <input
                type="text"
                className="form-control"
                value={food.brand || ""}
                onChange={(e) => onChangeFood({ brand: e.target.value })}
                placeholder="e.g. Tesco"
              />
            </div>

            <div className="col-12">
              <label className="form-label small text-dim mb-1">Serving label (optional)</label>
              <input
                type="text"
                className="form-control"
                value={food.servingSize || ""}
                onChange={(e) => onChangeFood({ servingSize: e.target.value })}
                placeholder={`e.g. 1 cup (240g) or 1 slice (40g)`}
              />
              <div className="small text-dim mt-1">
                Tip: include grams in brackets to enable “per serving” mode automatically.
              </div>
            </div>

            <div className="col-12 mt-2">
              <div className="fw-semibold small mb-1">Per 100 g macros</div>
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
                    placeholder="kcal/100g"
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
                    placeholder="per 100g"
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
                    placeholder="per 100g"
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
                    placeholder="per 100g"
                  />
                </div>
              </div>
            </div>
          </div>
          <hr className="my-3" />
        </div>
      )}

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
            onFocus={onSelectAll}
            placeholder="e.g. 100"
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
        <button
          className="btn btn-bxkr w-100"
          onClick={() => addEntry(meal, (scaledSelected || food) as Food)}
          disabled={!food.name || Number.isNaN(food.calories)}
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

      {/* Static summary */}
      <div className="fw-bold">
        {food.name || "Manual food"} {food.brand ? `(${food.brand})` : ""} — {round2(food.calories)} kcal/100g
      </div>

      {hasServing && (
        <div className="small text-dim">
          Serving: {food.servingSize}
          {food.caloriesPerServing != null && ` — ${round2(food.caloriesPerServing)} kcal/serving`}
        </div>
      )}
    </div>
  );
}
