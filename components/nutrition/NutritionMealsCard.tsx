// components/nutrition/NutritionMealsCard.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  return Number.isFinite(Number(n)) ? String(Math.round(Number(n))) : "0";
}

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

function stop(e: any) {
  e.preventDefault();
  e.stopPropagation();
}

export default function NutritionMealsCard({
  meals,
  entries,
  onAddFood,
  onSaveMeal,
  savingMealName,
  onEditEntry,
  onRemoveEntry,
  collapsible = true,
  defaultCollapsedEmpty = true,
}: {
  meals: readonly string[];
  entries: NutritionEntry[];
  onAddFood: (meal: string) => void;
  onSaveMeal: (meal: string) => void;
  savingMealName?: string | null;
  onEditEntry: (entry: NutritionEntry) => void;
  onRemoveEntry: (id: string) => void;
  collapsible?: boolean;
  defaultCollapsedEmpty?: boolean;
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

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const next: Record<string, boolean> = {};

    for (const m of meals) {
      const list = byMeal.get(m) || [];
      next[m] = defaultCollapsedEmpty ? list.length === 0 : false;
    }

    setCollapsed((prev) => (Object.keys(prev).length ? prev : next));
  }, [meals, byMeal, defaultCollapsedEmpty]);

  function toggleMeal(meal: string) {
    if (!collapsible) return;
    setCollapsed((prev) => ({ ...prev, [meal]: !prev[meal] }));
  }

  return (
    <section className="ia-tile ia-tile-pad mb-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="ia-tile-title">Meals</div>
      </div>

      {meals.map((meal, idx) => {
        const mealEntries = byMeal.get(meal) || [];
        const t = totalsFor(mealEntries);
        const isCollapsed = Boolean(collapsed[meal]);
        const canSaveMeal = mealEntries.length > 0;
        const isSaving = savingMealName === meal;

        return (
          <div key={meal}>
            <div
              className="d-flex justify-content-between align-items-center"
              style={{ paddingTop: idx === 0 ? 0 : 14 }}
            >
              <button
                type="button"
                className="btn btn-link p-0 text-start"
                onClick={() => toggleMeal(meal)}
                style={{
                  color: "#fff",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  minHeight: 44,
                }}
                aria-expanded={!isCollapsed}
              >
                {collapsible ? (
                  <span className="text-dim" style={{ width: 18, display: "inline-block" }}>
                    {isCollapsed ? "▸" : "▾"}
                  </span>
                ) : null}

                <span className="ia-tile-title">{meal}</span>
              </button>

              <div className="d-flex align-items-center gap-2">
                {canSaveMeal ? (
                  <button
                    type="button"
                    className="ia-btn ia-btn-muted"
                    onClick={() => onSaveMeal(meal)}
                    disabled={isSaving}
                    style={{ minHeight: 40 }}
                    title={`Save ${meal} as a reusable meal`}
                  >
                    {isSaving ? "Saving…" : "Save meal"}
                  </button>
                ) : null}

                <button
                  type="button"
                  className="ia-btn ia-btn-outline"
                  onClick={() => onAddFood(meal)}
                  style={{ minHeight: 40 }}
                >
                  + Add
                </button>
              </div>
            </div>

            <div className="small text-dim" style={{ lineHeight: 1.2, marginTop: 2 }}>
              <span style={{ color: COLORS.calories }}>{fmt0(t.calories)} kcal</span>{" "}
              <span className="text-dim">•</span>{" "}
              <span style={{ color: COLORS.protein }}>P {fmt0(t.protein)}</span>{" "}
              <span className="text-dim">•</span>{" "}
              <span style={{ color: COLORS.carbs }}>C {fmt0(t.carbs)}</span>{" "}
              <span className="text-dim">•</span>{" "}
              <span style={{ color: COLORS.fat }}>F {fmt0(t.fat)}</span>
            </div>

            {!isCollapsed && (
              <div style={{ marginTop: 10 }}>
                {mealEntries.length === 0 ? (
                  <div className="small text-dim" style={{ padding: "8px 0 2px" }}>
                    No foods logged
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: 12,
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.06)",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    {mealEntries.map((e, rowIdx) => {
                      const name = e.food?.name || "Food";
                      const brand = (e.food as any)?.brand ? String((e.food as any).brand) : "";

                      return (
                        <div
                          key={e.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            padding: "10px 12px",
                            borderTop:
                              rowIdx === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          <button
                            type="button"
                            className="btn btn-link text-start p-0"
                            onClick={() => onEditEntry(e)}
                            style={{
                              color: "#fff",
                              textDecoration: "none",
                              flex: 1,
                              minWidth: 0,
                              minHeight: 44,
                            }}
                          >
                            <div
                              className="fw-semibold"
                              style={{
                                fontSize: 14,
                                lineHeight: 1.2,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {name}
                            </div>

                            <div className="small text-dim" style={{ lineHeight: 1.2 }}>
                              {brand ? <span style={{ marginRight: 10 }}>{brand}</span> : null}
                              <span style={{ color: COLORS.calories }}>
                                {fmt0(e.calories)} kcal
                              </span>{" "}
                              <span className="text-dim">•</span>{" "}
                              <span style={{ color: COLORS.protein }}>P {fmt0(e.protein)}</span>{" "}
                              <span style={{ color: COLORS.carbs }}>C {fmt0(e.carbs)}</span>{" "}
                              <span style={{ color: COLORS.fat }}>F {fmt0(e.fat)}</span>
                            </div>
                          </button>

                          <button
                            type="button"
                            className="ia-btn ia-btn-outline"
                            onClick={(ev) => {
                              stop(ev);
                              onRemoveEntry(e.id);
                            }}
                            title="Remove"
                            aria-label="Remove"
                            style={{
                              borderRadius: 999,
                              minHeight: 40,
                              minWidth: 40,
                              padding: 0,
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                marginTop: 14,
                borderBottom:
                  idx === meals.length - 1 ? "none" : "1px solid rgba(255,255,255,0.08)",
              }}
            />
          </div>
        );
      })}
    </section>
  );
}
