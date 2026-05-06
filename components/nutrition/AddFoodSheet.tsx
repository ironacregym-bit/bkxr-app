// components/nutrition/AddFoodSheet.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import FoodEditor, { Food } from "./FoodEditor";
import BarcodeScannerGate from "./BarcodeScannerGate";
import { NUTRITION_ACCENT as ACCENT } from "./nutritionTheme";

function parseServingGrams(servingSize?: string | null): number | null {
  if (!servingSize) return null;
  const m = servingSize.match(/(\d+(\.\d+)?)\s*g/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

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

  selectedFood: Food | null;
  usingServing: "per100" | "serving";
  setUsingServing: (v: "per100" | "serving") => void;
  addEntry: (meal: string, food: Food) => void;
  toggleFavourite: (food: Food) => void;
  isFavourite: (food: Food | null) => boolean;
  onChangeFood: (patch: Partial<Food>) => void;
}) {
  const [grams, setGrams] = useState<number>(100);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  useEffect(() => {
    if (!selectedFood) return;
    if (String(selectedFood.id || "").startsWith("manual-")) return;
    const g = parseServingGrams(selectedFood.servingSize);
    setGrams(g && g > 0 ? g : 100);
  }, [selectedFood]);

  const servingG = useMemo(() => {
    if (!selectedFood) return null;
    return parseServingGrams(selectedFood.servingSize);
  }, [selectedFood]);

  const chips = useMemo(() => [25, 50, 75, 100], []);

  if (!open || !meal) return null;

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1050 }}>
      <div
        className="position-absolute top-0 start-0 w-100 h-100"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
      />

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
            <button className="btn btn-sm btn-outline-light" onClick={onClose} style={{ borderRadius: 999 }}>
              ✕
            </button>
          </div>

          {selectedFood ? (
            <>
              {/* Grams chips (non-manual only) */}
              {!String(selectedFood.id || "").startsWith("manual-") && (
                <div className="mb-2">
                  <div className="small text-dim mb-1">Amount</div>
                  <div className="d-flex flex-wrap" style={{ gap: 8 }}>
                    {chips.map((g) => (
                      <button
                        key={g}
                        className={`btn btn-sm ${Math.round(grams) === g ? "btn-bxkr" : "btn-bxkr-outline"}`}
                        style={{ borderRadius: 999 }}
                        onClick={() => setGrams(g)}
                      >
                        {g}g
                      </button>
                    ))}

                    {servingG ? (
                      <button
                        className={`btn btn-sm ${Math.round(grams) === Math.round(servingG) ? "btn-bxkr" : "btn-bxkr-outline"}`}
                        style={{ borderRadius: 999 }}
                        onClick={() => setGrams(servingG)}
                        title={selectedFood.servingSize || "Serving"}
                      >
                        Serving
                      </button>
                    ) : null}
                  </div>
                </div>
              )}

              <FoodEditor
                meal={meal}
                food={selectedFood}
                usingServing={usingServing}
                setUsingServing={setUsingServing}
                scaledSelected={null}
                addEntry={(m, f) => addEntry(m, f)}
                isFavourite={Boolean(isFavourite(selectedFood))}
                onToggleFavourite={() => toggleFavourite(selectedFood)}
                onChangeFood={onChangeFood}
                onCancel={onClose}
                gramsOverride={!String(selectedFood.id || "").startsWith("manual-") ? grams : null}
                onGramsChange={(g) => setGrams(g)}
              />
            </>
          ) : (
            <>
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

              {favourites.length > 0 && (
                <div className="mb-2">
                  <div className="small text-dim mb-1">Favourites</div>
                  <div className="d-flex flex-wrap" style={{ gap: 8 }}>
                    {favourites.map((f) => (
                      <button
                        key={(f.id || f.code || f.name) + "-fav"}
                        className="btn btn-sm"
                        style={{
                          borderRadius: 999,
                          border: `1px solid ${ACCENT}55`,
                          background: "rgba(255,255,255,0.04)",
                          color: "#fff",
                        }}
                        onClick={() => onSelectFood(f)}
                        title="Use favourite"
                      >
                        ⭐ {f.name || f.code || "Food"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                          key={(food.id || food.code || food.name) + "-res"}
                          className="futuristic-card p-2 text-start"
                          onClick={() => onSelectFood(food)}
                        >
                          <div className="fw-semibold" style={{ lineHeight: 1.2 }}>
                            {food.name || food.code || "Food"}
                          </div>
                          <div className="small text-dim">
                            {Number(food.calories || 0)} kcal / 100g
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <BarcodeScannerGate isPremium={isPremium} onScanRequested={onScanRequested} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
