// File: components/nutrition/NutritionMealsCard.tsx
"use client";

import React, { useMemo } from "react";
import type { MacroTotals } from "./MacrosCard";
import type { Food } from "./FoodEditor";
import { NUTRITION_COLORS as COLORS } from "./nutritionTheme";

type NutritionEntry = {
  id: string;
  meal: string;
  food: Food;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

function fmt0(n: number | undefined | null) {
  return Number.isFinite(Number(n)) ? String(Math.round(Number(n))) : "-";
}

export default function NutritionMealsCard({
  meals,
  entries,
  onAddFood,
  onEditEntry,
  onRemoveEntry,
}: {
  meals: readonly string[];
  entries: NutritionEntry[];
  onAddFood: (meal: string) => void;
  onEditEntry: (entry: NutritionEntry) => void;
  onRemoveEntry: (id: string) => void;
}) {
  const byMeal = useMemo(() => {
    const map = new Map<string, NutritionEntry[]>();
    for (const m of meals) map.set(m, []);
    for (const e of entries || []) {
      const key = e.meal || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [entries, meals]);

  function totalsFor(list: NutritionEntry[]): MacroTotals {
    return (list || []).reduce(
      (acc, e) => ({
        calories: acc.calories + (e.calories || 0),
        protein: acc.protein + (e.protein || 0),
        carbs: acc.carbs + (e.carbs || 0),
        fat: acc.fat + (e.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }

  return (
    <section className="futuristic-card p-3 mb-3">
      <h5 className="mb-3">Meals</h5>

      {meals.map((meal) => {
        const mealEntries = byMeal.get(meal) || [];
        const t = totalsFor(mealEntries);

        return (
          <div key={meal} className="mb-3">
            <div className="d-flex justify-content-between align-items-center">
              <div className="fw-semibold">{meal}</div>
              <button className="btn btn-sm btn-bxkr-outline" onClick={() => onAddFood(meal)}>
                + Add
              </button>
            </div>

            <div className="small text-dim mt-1">
              <span style={{ color: COLORS.calories }}>{fmt0(t.calories)} kcal</span>{" "}
              <span className="text-dim">•</span>{" "}
              <span style={{ color: COLORS.protein }}>P {fmt0(t.protein)}</span>{" "}
              <span className="text-dim">•</span>{" "}
              <span style={{ color: COLORS.carbs }}>C {fmt0(t.carbs)}</span>{" "}
              <span className="text-dim">•</span>{" "}
              <span style={{ color: COLORS.fat }}>F {fmt0(t.fat)}</span>
            </div>

            {mealEntries.length === 0 ? (
              <div className="small text-dim mt-2">No foods logged</div>
            ) : (
              <div className="d-flex flex-column mt-2" style={{ gap: 10 }}>
                {mealEntries.map((e) => (
                  <div key={e.id} className="d-flex justify-content-between align-items-center">
                    <button className="btn btn-link text-start p-0" onClick={() => onEditEntry(e)}>
                      <div className="fw-semibold" style={{ lineHeight: 1.2 }}>
                        {e.food?.name || "Food"}
                      </div>
                      <div className="small text-dim">
                        <span style={{ color: COLORS.calories }}>{fmt0(e.calories)} kcal</span>
                      </div>
                    </button>

                    <button className="btn btn-sm btn-outline-danger" onClick={() => onRemoveEntry(e.id)} title="Remove">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
