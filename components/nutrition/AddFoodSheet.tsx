// File: components/nutrition/AddFoodSheet.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import FoodEditor, { Food } from "./FoodEditor";
import BarcodeScannerGate from "./BarcodeScannerGate";
import { NUTRITION_ACCENT as ACCENT } from "./nutritionTheme";
import { NUTRITION_COLORS as COLORS } from "./nutritionTheme";

function parseServingGrams(servingSize?: string | null): number | null {
  if (!servingSize) return null;
  const m = servingSize.match(/(\d+(\.\d+)?)\s*g/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function fmt0(n: any) {
  const v = Number(n);
  return Number.isFinite(v) ? String(Math.round(v)) : "-";
}

function stop(e: any) {
  e.preventDefault();
  e.stopPropagation();
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
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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

  const sheetTitle = meal ? `Add food to ${meal}` : "Add food";

  if (!open || !meal) return null;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100"
      style={{ zIndex: 1050 }}
      role="dialog"
      aria-modal="true"
      aria-label={sheetTitle}
    >
      <div
        className="position-absolute top-0 start-0 w-100 h-100"
        style={{ background: "rgba(0,0,0,0.6)" }}
        onClick={onClose}
      />

      <div
        className="position-absolute bottom-0 start-0 w-100"
        style={{
          background: "#0b0f14",
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          maxHeight: "85vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          boxShadow: "0 -18px 40px rgba(0,0,0,0.45)",
        }}
      >
        <div className="p-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="fw-bold" style={{ fontSize: 16 }}>
              {sheetTitle}
            </div>
            <button
              className="btn btn-sm btn-outline-light"
              onClick={onClose}
              style={{ borderRadius: 999, minHeight: 40, minWidth: 40 }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {selectedFood ? (
            <>
              {!String(selectedFood.id || "").startsWith("manual-") && (
                <div className="mb-2">
                  <div className="small text-dim mb-1">Amount</div>
                  <div className="d-flex flex-wrap" style={{ gap: 8 }}>
                    {chips.map((g) => (
                      <button
                        key={g}
                        className={`btn btn-sm ${Math.round(grams) === g ? "btn-bxkr" : "btn-bxkr-outline"}`}
                        style={{ borderRadius: 999, minHeight: 40 }}
                        onClick={() => setGrams(g)}
                      >
                        {g}g
                      </button>
                    ))}

                    {servingG ? (
                      <button
                        className={`btn btn-sm ${
                          Math.round(grams) === Math.round(servingG) ? "btn-bxkr" : "btn-bxkr-outline"
                        }`}
                        style={{ borderRadius: 999, minHeight: 40 }}
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
                  style={{ minHeight: 44 }}
                  autoFocus
                />
                <button
                  className="btn btn-sm"
                  style={{
                    minHeight: 44,
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
                <div className="mb-3">
                  <div className="small text-dim mb-1">Favourites</div>
                  <div className="d-flex flex-wrap" style={{ gap: 8 }}>
                    {favourites.slice(0, 24).map((f) => (
                      <button
                        key={(f.id || f.code || f.name) + "-fav"}
                        className="btn btn-sm"
                        style={{
                          minHeight: 40,
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
                    <div className="d-flex flex-column" style={{ gap: 10 }}>
                      {results.map((food) => {
                        const fav = isFavourite(food);
                        const name = food.name || food.code || "Food";
                        const brand = (food as any)?.brand ? String((food as any).brand) : "";
                        return (
                          <div
                            key={(food.id || food.code || name) + "-res"}
                            className="futuristic-card p-2"
                            style={{
                              borderRadius: 14,
                              minHeight: 56,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                            }}
                          >
                            <button
                              className="btn btn-link text-start p-0"
                              style={{ color: "#fff", textDecoration: "none", flex: 1, minWidth: 0 }}
                              onClick={() => onSelectFood(food)}
                            >
                              <div className="fw-semibold" style={{ lineHeight: 1.2, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {name}
                              </div>
                              <div className="small text-dim" style={{ lineHeight: 1.2 }}>
                                {brand ? (
                                  <span style={{ marginRight: 10 }}>{brand}</span>
                                ) : null}
                                <span style={{ color: COLORS.calories }}>{fmt0(food.calories)} kcal</span>
                                <span className="text-dim"> /100g</span>
                              </div>
                            </button>

                            <button
                              className="btn btn-sm btn-outline-light"
                              style={{ borderRadius: 999, minHeight: 40, minWidth: 40 }}
                              onClick={(e) => {
                                stop(e);
                                toggleFavourite(food);
                              }}
                              title={fav ? "Unfavourite" : "Favourite"}
                              aria-label={fav ? "Unfavourite" : "Favourite"}
                            >
                              <i className={fav ? "fas fa-star text-warning" : "far fa-star text-dim"} />
                            </button>
                          </div>
                        );
                      })}
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
