// components/nutrition/NutritionMealsCard.tsx
"use client";

import React from "react";
import type { MacroTotals } from "./MacrosCard";
import type { Food } from "./FoodEditor";

type NutritionEntry = {
  id: string;
  meal: string;
  food: Food;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const COLORS = {
  calories: "#ff7f32",
  protein: "#32ff7f",
  carbs: "#ffc107",
  fat: "#ff4fa3",
};

function round2(n: number | undefined | null) {
  return n !== undefined && n !== null ? Number(n).toFixed(0) : "-";
}

type Props = {
  meals: readonly string[];
  entries: NutritionEntry[];
  onAddFood: (meal: string) => void;
  onEditEntry: (entry: NutritionEntry) => void;
  onRemoveEntry: (id: string) => void;
};

export default function NutritionMealsCard({
  meals,
  entries,
  onAddFood,
  onEditEntry,
  onRemoveEntry,
}: Props) {
  function totalsForMeal(meal: string): MacroTotals {
    return entries
      .filter((e) => e.meal === meal)
      .reduce(
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
        const mealEntries = entries.filter((e) => e.meal === meal);
        const t = totalsForMeal(meal);

        return (
          <div key={meal} className="mb-3">
            {/* Meal header */}
            <div className="d-flex justify-content-between align-items-center mb-1">
              <div className="fw-semibold">{meal}</div>
              <button
                className="btn btn-sm btn-bxkr-outline"
                onClick={() => onAddFood(meal)}
              >
                + Add
              </button>
            </div>

            {/* Totals */}
            <div className="small mb-2 text-dim">
              <span style={{ color: COLORS.calories }}>
                {round2(t.calories)} kcal
              </span>{" "}
              •{" "}
              <span style={{ color: COLORS.protein }}>
                P {round2(t.protein)}
              </span>{" "}
              •{" "}
              <span style={{ color: COLORS.carbs }}>
                C {round2(t.carbs)}
              </span>{" "}
              •{" "}
              <span style={{ color: COLORS.fat }}>
                F {round2(t.fat)}
              </span>
            </div>

            {/* Entries */}
            {mealEntries.length === 0 ? (
              <div className="small text-dim">No foods logged</div>
            ) : (
              <div className="d-flex flex-column" style={{ gap: 8 }}>
                {mealEntries.map((e) => (
                  <div
                    key={e.id}
                    className="d-flex justify-content-between align-items-center"
                  >
                    <button
                      className="btn btn-link text-start p-0"
                      onClick={() => onEditEntry(e)}
                    >
                      <div className="fw-semibold" style={{ lineHeight: 1.2 }}>
                        {e.food.name || "Food"}
                      </div>
                      <div className="small text-dim">
                        <span style={{ color: COLORS.calories }}>
                          {round2(e.calories)} kcal
                        </span>
                      </div>
                    </button>

                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => onRemoveEntry(e.id)}
                      title="Remove entry"
                    >
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
