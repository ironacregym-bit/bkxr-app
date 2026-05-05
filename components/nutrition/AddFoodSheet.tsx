// components/nutrition/AddFoodSheet.tsx
"use client";

import React, { useEffect } from "react";
import FoodEditor, { Food } from "./FoodEditor";
import BarcodeScannerGate from "./BarcodeScannerGate";

const ACCENT = "#ff8a2a";

export default function AddFoodSheet({
  open,
  meal,
  query,
  setQuery,
  results,
  loading,
  favourites,
  onSelectFood,
  onCreateManual,
  onClose,
  isPremium,
  onScanRequested,
  selectedFood,
  usingServing,
  setUsingServing,
  addEntry,
  toggleFavourite,
  isFavourite,
  onChangeFood,
}: {
  open: boolean;
  meal: string | null;
  query: string;
  setQuery: (v: string) => void;
  results: Food[];
  loading: boolean;
  favourites: Food[];
  onSelectFood: (food: Food) => void;
  onCreateManual: () => void;
  onClose: () => void;
  isPremium: boolean;
  onScanRequested: () => void;

  // editor props
  selectedFood: Food | null;
  usingServing: "per100" | "serving";
  setUsingServing: (v: "per100" | "serving") => void;
  addEntry: (meal: string, food: Food) => void;
  toggleFavourite: (food: Food) => void;
  isFavourite: (food: Food | null) => boolean;
  onChangeFood: (patch: Partial<Food>) => void;
}) {
  // lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  if (!open || !meal) return null;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100"
      style={{ zIndex: 1050 }}
    >
      {/* backdrop */}
      <div
        className="position-absolute top-0 start-0 w-100 h-100"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
      />

      {/* sheet */}
      <div
        className="position-absolute bottom-0 start-0 w-100"
        style={{
          background: "#0b0f14",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div className="p-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="fw-bold">Add food to {meal}</div>
            <button
              className="btn btn-sm btn-outline-light"
              onClick={onClose}
              style={{ borderRadius: 999 }}
            >
              ✕
            </button>
          </div>

          {/* If editing a food → show editor only */}
          {selectedFood ? (
            <FoodEditor
              meal={meal}
              food={selectedFood}
              usingServing={usingServing}
              setUsingServing={setUsingServing}
              scaledSelected={null}
              addEntry={addEntry}
              isFavourite={isFavourite(selectedFood)}
              onToggleFavourite={() => toggleFavourite(selectedFood)}
              onChangeFood={onChangeFood}
              onCancel={onClose}
            />
          ) : (
            <>
              {/* Search */}
              <div className="d-flex gap-2 mb-2">
                <input
                  className="form-control"
                  placeholder="Search foods…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button
                  className="btn btn-sm"
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${ACCENT}`,
                    color: ACCENT,
                    background: "transparent",
                    whiteSpace: "nowrap",
                  }}
                  onClick={onCreateManual}
                >
                  + Manual
                </button>
              </div>

              {/* Favourites */}
              {favourites.length > 0 && (
                <div className="mb-2">
                  <div className="small text-dim mb-1">Favourites</div>
                  <div className="d-flex flex-wrap" style={{ gap: 8 }}>
                    {favourites.map((f) => (
                      <button
                        key={f.id}
                        className="btn btn-sm"
                        style={{
                          borderRadius: 999,
                          border: `1px solid ${ACCENT}55`,
                          background: "rgba(255,255,255,0.04)",
                          color: "#fff",
                        }}
                        onClick={() => onSelectFood(f)}
                      >
                        ⭐ {f.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Results */}
              {query.trim().length >= 2 && (
                <div className="mb-2">
                  {loading ? (
                    <div className="text-dim small">Searching…</div>
                  ) : results.length === 0 ? (
                    <div className="text-dim small">No foods found</div>
                  ) : (
                    <div className="d-flex flex-column" style={{ gap: 8 }}>
                      {results.map((food) => (
                        <button
                          key={food.id}
                          className="futuristic-card p-2 text-start"
                          onClick={() => onSelectFood(food)}
                        >
                          <div className="fw-semibold">
                            {food.name || "Food"}
                          </div>
                          <div className="small text-dim">
                            {food.calories} kcal / 100g
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Scanner */}
              <BarcodeScannerGate
                isPremium={isPremium}
                onScanRequested={onScanRequested}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
