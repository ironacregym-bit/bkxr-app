
"use client";

import React from "react";

const COLORS = {
  calories: "#ff7f32",
  protein: "#32ff7f",
  carbs: "#ffc107",
  fat: "#ff4fa3",
};

export type Food = {
  id: string;
  code: string;
  name: string;
  brand: string;
  image: string | null;
  calories: number; // per 100g or per-serving after scaling
  protein: number;
  carbs: number;
  fat: number;
  servingSize?: string | null;
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

  return (
    <div className="bxkr-card p-3 mb-2">
      <div className="d-flex justify-content-between align-items-start">
        <div>
          <div className="fw-bold d-flex align-items-center">
            <input
              className="form-control form-control-sm bg-transparent text-white border-0 p-0 fw-bold"
              style={{ maxWidth: 280 }}
              placeholder="Food name"
              value={food.name}
              onChange={(e) => (food.name = e.target.value)}
            />
            <button
              type="button"
              className="btn btn-link p-0 ms-2"
              onClick={onToggleFavourite}
              title={isFavourite ? "Unfavourite" : "Favourite"}
            >
              <i className={isFavourite ? "fas fa-star text-warning" : "far fa-star text-dim"} />
            </button>
          </div>
          <input
            className="form-control form-control-sm bg-transparent text-dim border-0 p-0"
            style={{ maxWidth: 280 }}
            placeholder="Brand"
            value={food.brand}
            onChange={(e) => (food.brand = e.target.value)}
          />
        </div>
        <div className="text-end">
          {usingServing === "serving" && hasServing ? (
            <div className="small text-dim">{servingLabel}</div>
          ) : (
            <div className="small text-dim">{grams} g</div>
          )}
        </div>
      </div>

      <div className="d-flex gap-2 align-items-center mt-2">
        {hasServing && (
          <div className="btn-group btn-group-sm" role="group" aria-label="Amount type">
            <button
              type="button"
              className={`btn ${usingServing === "per100" ? "btn-bxkr" : "btn-bxkr-outline"}`}
              onClick={() => setUsingServing("per100")}
            >
              Per 100 g
            </button>
            <button
              type="button"
              className={`btn ${usingServing === "serving" ? "btn-bxkr" : "btn-bxkr-outline"}`}
              onClick={() => setUsingServing("serving")}
            >
              Per serving
            </button>
          </div>
        )}
        {usingServing === "per100" && (
          <input
            type="number"
            className="form-control form-control-sm"
            placeholder="Grams"
            min={1}
            step={1}
            value={grams}
            onChange={(e) => setGrams(Number(e.target.value || 0))}
          />
        )}
      </div>

      {scaledSelected && (
        <div className="mt-2">
          <div className="small">
            <span style={{ color: COLORS.calories }}>{scaledSelected.calories.toFixed(2)} kcal</span>{" "}
            | <span style={{ color: COLORS.protein }}>{scaledSelected.protein.toFixed(2)}p</span>{" "}
            | <span style={{ color: COLORS.carbs }}>{scaledSelected.carbs.toFixed(2)}c</span>{" "}
            | <span style={{ color: COLORS.fat }}>{scaledSelected.fat.toFixed(2)}f</span>
          </div>
        </div>
      )}

      <div className="d-flex justify-content-end mt-3">
        <button className="btn btn-bxkr" onClick={() => addEntry(meal, scaledSelected || food)}>
          Add to {meal}
        </button>
      </div>
    </div>
  );
}
