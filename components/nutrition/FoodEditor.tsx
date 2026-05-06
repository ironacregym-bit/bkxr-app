"use client";

// File: components/nutrition/FoodEditor.tsx

import React, { useEffect, useMemo, useState } from "react";
import { NUTRITION_COLORS as COLORS } from "./nutritionTheme";

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
  servingSize?: string | null;
  caloriesPerServing?: number | null;
  proteinPerServing?: number | null;
  carbsPerServing?: number | null;
  fatPerServing?: number | null;
};

type PortionPreset = {
  key: string;
  label: string;
  grams: number;
  hint?: string;
};

function parseServingGrams(s?: string | null): number | null {
  if (!s) return null;
  const match = s.match(/(\d+(\.\d+)?)\s*g/i);
  if (match) {
    const n = Number(match[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/**
 * Lightweight “best effort” portion presets.
 * These are approximate, but massively improve UX (MyFitnessPal-style).
 * You can later move these into Firestore/admin if you want.
 */
function getPortionPresets(food: Food): PortionPreset[] {
  const name = String(food?.name || "").toLowerCase();
  const brand = String(food?.brand || "").toLowerCase();
  const text = `${name} ${brand}`;

  const presets: PortionPreset[] = [];

  // Bacon rashers (UK-ish typical)
  if (/(bacon|rashers|rasher|back bacon|streaky)/i.test(text)) {
    presets.push({
      key: "rasher",
      label: "1 rasher",
      grams: 30,
      hint: "Approx. 30g per rasher (varies by brand/cut)",
    });
  }

  // Bread slice
  if (/(bread|toast|loaf|sandwich)/i.test(text)) {
    presets.push({
      key: "slice",
      label: "1 slice",
      grams: 40,
      hint: "Approx. 40g per slice (varies by bread type)",
    });
  }

  // Egg
  if (/(egg|eggs)/i.test(text)) {
    presets.push({
      key: "egg",
      label: "1 egg",
      grams: 50,
      hint: "Approx. 50g edible weight (large egg varies)",
    });
  }

  // Wrap/tortilla
  if (/(wrap|tortilla)/i.test(text)) {
    presets.push({
      key: "wrap",
      label: "1 wrap",
      grams: 60,
      hint: "Approx. 60g per wrap (varies by size)",
    });
  }

  // Protein powder scoop
  if (/(whey|protein powder|protein|casein|mass gainer|iso whey|wpc|wpi)/i.test(text)) {
    presets.push({
      key: "scoop",
      label: "1 scoop",
      grams: 30,
      hint: "Common scoop ≈ 30g (check tub label)",
    });
  }

  // Rice cake
  if (/(rice cake|ricecake)/i.test(text)) {
    presets.push({
      key: "ricecake",
      label: "1 cake",
      grams: 9,
      hint: "Typical rice cake ≈ 9g",
    });
  }

  // Sausage
  if (/(sausage|sausages)/i.test(text)) {
    presets.push({
      key: "sausage",
      label: "1 sausage",
      grams: 50,
      hint: "Approx. 50g (varies by type/brand)",
    });
  }

  // If nothing matched, keep it empty.
  return presets;
}

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
  onCancel,
  gramsOverride,
  onGramsChange,
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
  gramsOverride?: number | null;
  onGramsChange?: (g: number) => void;
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

  // =========================
  // Manual mode (unchanged logic, updated styling)
  // =========================
  if (manualMode) {
    return (
      <div className="ia-tile ia-tile-pad" style={{ scrollMarginTop: 12 }}>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="ia-tile-title">Add item</div>

          <div className="d-flex align-items-center" style={{ gap: 8 }}>
            <button
              type="button"
              className="ia-btn ia-btn-outline"
              onClick={onToggleFavourite}
              title={isFavourite ? "Unfavourite" : "Favourite"}
              style={{ borderRadius: 999, minWidth: 40, minHeight: 40, padding: 0 }}
            >
              <i className={isFavourite ? "fas fa-star text-warning" : "far fa-star"} />
            </button>

            {onCancel && (
              <button
                type="button"
                className="ia-btn ia-btn-outline"
                onClick={onCancel}
                aria-label="Cancel"
                style={{ borderRadius: 999, minWidth: 40, minHeight: 40, padding: 0 }}
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

        <button
          type="button"
          className="ia-btn ia-btn-primary w-100"
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
    );
  }

  // =========================
  // Non-manual mode (grams + serving + portion chips)
  // =========================
  const servingG = parseServingGrams(food.servingSize);

  const hasPer100 =
    Number.isFinite(food.calories) ||
    Number.isFinite(food.protein) ||
    Number.isFinite(food.carbs) ||
    Number.isFinite(food.fat);

  const hasPerServing =
    food.caloriesPerServing != null ||
    food.proteinPerServing != null ||
    food.carbsPerServing != null ||
    food.fatPerServing != null;

  const portionPresets = useMemo(() => getPortionPresets(food), [food.id]);

  const [grams, setGrams] = useState<number>(100);

  // Portion mode state
  const [mode, setMode] = useState<"grams" | "portion">("grams");
  const [portionKey, setPortionKey] = useState<string | null>(null);
  const [portionBaseG, setPortionBaseG] = useState<number | null>(null);
  const [portionQty, setPortionQty] = useState<number>(1);

  // Default grams when switching foods
  useEffect(() => {
    setMode("grams");
    setPortionKey(null);
    setPortionBaseG(null);
    setPortionQty(1);

    if (servingG && servingG > 0) setGrams(servingG);
    else setGrams(100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [food.id]);

  // Respect gramsOverride from AddFoodSheet chips
  useEffect(() => {
    if (gramsOverride == null) return;
    if (!Number.isFinite(gramsOverride)) return;
    if (Math.round(gramsOverride) === Math.round(grams)) return;

    setMode("grams");
    setPortionKey(null);
    setPortionBaseG(null);
    setPortionQty(1);
    setGrams(Math.max(0, Number(gramsOverride)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gramsOverride]);

  // Report grams up
  useEffect(() => {
    if (onGramsChange) onGramsChange(grams);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grams]);

  // When in portion mode, recompute grams from base * qty
  useEffect(() => {
    if (mode !== "portion") return;
    if (!portionBaseG) return;
    const next = Math.max(0, portionBaseG * Math.max(1, portionQty));
    if (Math.round(next) === Math.round(grams)) return;
    setGrams(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, portionBaseG, portionQty]);

  function setPortion(p: PortionPreset) {
    setMode("portion");
    setPortionKey(p.key);
    setPortionBaseG(p.grams);
    setPortionQty(1);
    setGrams(p.grams);
  }

  function setServingAsPortion() {
    if (!servingG) return;
    setMode("portion");
    setPortionKey("serving");
    setPortionBaseG(servingG);
    setPortionQty(1);
    setGrams(servingG);
  }

  function set100g() {
    setMode("grams");
    setPortionKey(null);
    setPortionBaseG(null);
    setPortionQty(1);
    setGrams(100);
  }

  function calcFromGrams(g: number) {
    const safeG = Math.max(0, g || 0);

    // Per 100g baseline
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

    // Per serving + serving grams known
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

    // Last resort: per serving only (treat any positive grams as 1 serving)
    if (hasPerServing) {
      const multiplier = safeG > 0 ? 1 : 0;
      return {
        calories: +(Number(food.caloriesPerServing || 0) * multiplier).toFixed(2),
        protein: +(Number(food.proteinPerServing || 0) * multiplier).toFixed(2),
        carbs: +(Number(food.carbsPerServing || 0) * multiplier).toFixed(2),
        fat: +(Number(food.fatPerServing || 0) * multiplier).toFixed(2),
      };
    }

    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  const derived = calcFromGrams(grams);

  const foodForSave: Food = {
    ...food,
    calories: derived.calories,
    protein: derived.protein,
    carbs: derived.carbs,
    fat: derived.fat,
  };

  const showServingChip = Boolean(servingG && servingG > 0);
  const showPortions = portionPresets.length > 0;

  return (
    <div className="ia-tile ia-tile-pad" style={{ scrollMarginTop: 12 }}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div style={{ minWidth: 0 }}>
          <div className="ia-tile-title" style={{ margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {food.name || food.code || "Food"}
          </div>
          {food.brand ? <div className="text-dim small">{food.brand}</div> : null}
        </div>

        <div className="d-flex align-items-center" style={{ gap: 8 }}>
          <button
            type="button"
            className="ia-btn ia-btn-outline"
            onClick={onToggleFavourite}
            title={isFavourite ? "Unfavourite" : "Favourite"}
            style={{ borderRadius: 999, minWidth: 40, minHeight: 40, padding: 0 }}
          >
            <i className={isFavourite ? "fas fa-star text-warning" : "far fa-star"} />
          </button>

          {onCancel && (
            <button
              type="button"
              className="ia-btn ia-btn-outline"
              onClick={onCancel}
              aria-label="Cancel"
              style={{ borderRadius: 999, minWidth: 40, minHeight: 40, padding: 0 }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Portion chips */}
      <div className="mb-2">
        <div className="ia-kicker mb-1">Portions</div>

        <div className="d-flex flex-wrap" style={{ gap: 8 }}>
          <button
            type="button"
            className={mode === "grams" && Math.round(grams) === 100 ? "ia-btn ia-btn-primary" : "ia-btn ia-btn-outline"}
            style={{ borderRadius: 999, minHeight: 40, padding: "8px 12px" }}
            onClick={set100g}
            title="Standard reference"
          >
            100g
          </button>

          {showServingChip ? (
            <button
              type="button"
              className={mode === "portion" && portionKey === "serving" ? "ia-btn ia-btn-primary" : "ia-btn ia-btn-outline"}
              style={{ borderRadius: 999, minHeight: 40, padding: "8px 12px" }}
              onClick={setServingAsPortion}
              title={food.servingSize || "Serving"}
            >
              Serving
            </button>
          ) : null}

          {showPortions
            ? portionPresets.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={mode === "portion" && portionKey === p.key ? "ia-btn ia-btn-primary" : "ia-btn ia-btn-outline"}
                  style={{ borderRadius: 999, minHeight: 40, padding: "8px 12px" }}
                  onClick={() => setPortion(p)}
                  title={p.hint || ""}
                >
                  {p.label}
                </button>
              ))
            : null}
        </div>

        {mode === "portion" && portionBaseG ? (
          <div className="d-flex align-items-center mt-2" style={{ gap: 10 }}>
            <div className="text-dim small">
              {portionQty} × {portionBaseG}g = <span style={{ color: COLORS.calories }}>{Math.round(grams)}g</span>
            </div>

            <div className="ms-auto d-flex" style={{ gap: 8 }}>
              <button
                type="button"
                className="ia-btn ia-btn-outline"
                style={{ borderRadius: 999, minWidth: 40, minHeight: 40, padding: 0 }}
                onClick={() => setPortionQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease portion"
              >
                −
              </button>
              <button
                type="button"
                className="ia-btn ia-btn-outline"
                style={{ borderRadius: 999, minWidth: 40, minHeight: 40, padding: 0 }}
                onClick={() => setPortionQty((q) => Math.min(20, q + 1))}
                aria-label="Increase portion"
              >
                +
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Grams input (still always available; switches mode back to grams when edited) */}
      <div className="row g-2">
        <div className="col-12 col-md-5">
          <label className="form-label small text-dim mb-1">Amount (grams)</label>
          <input
            type="number"
            className="form-control"
            inputMode="decimal"
            min={0}
            value={Number.isFinite(grams) ? grams : 0}
            onChange={(e) => {
              setMode("grams");
              setPortionKey(null);
              setPortionBaseG(null);
              setPortionQty(1);
              setGrams(Math.max(0, Number(e.target.value || 0)));
            }}
            onFocus={onSelectAll}
            placeholder={servingG ? `${servingG} g` : "e.g., 75"}
          />
          {servingG ? (
            <div className="small text-dim mt-1">Serving size detected: {food.servingSize}</div>
          ) : hasPerServing ? (
            <div className="small text-dim mt-1">Per serving values available (serving grams unknown)</div>
          ) : (
            <div className="small text-dim mt-1">Using per 100g baseline</div>
          )}
        </div>
      </div>

      <div className="d-flex justify-content-between small my-2">
        <span style={{ color: COLORS.calories }}>{round2(derived.calories)} kcal</span>
        <span style={{ color: COLORS.protein }}>{round2(derived.protein)}p</span>
        <span style={{ color: COLORS.carbs }}>{round2(derived.carbs)}c</span>
        <span style={{ color: COLORS.fat }}>{round2(derived.fat)}f</span>
      </div>

      <button
        type="button"
        className="ia-btn ia-btn-primary w-100"
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
  );
}
