// components/nutrition/AddFoodSheet.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FoodEditor, { Food } from "./FoodEditor";
import BarcodeScannerGate from "./BarcodeScannerGate";
import { NUTRITION_ACCENT as ACCENT, NUTRITION_COLORS as COLORS } from "./nutritionTheme";

type SavedMealItem = {
  food: Food;
  grams?: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type SavedMeal = {
  id: string;
  name: string;
  source_meal?: string;
  item_count?: number;
  totals?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  items: SavedMealItem[];
  created_at?: string;
  updated_at?: string;
  last_used_at?: string | null;
};

function parseServingGrams(servingSize?: string | null): number | null {
  if (!servingSize) return null;

  const match = servingSize.match(/(\d+(\.\d+)?)\s*g/i);
  if (!match) return null;

  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function fmt0(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? String(Math.round(v)) : "0";
}

function stop(e: React.MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

function clampGrams(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5000, Math.round(n)));
}

function normaliseSearch(value: string) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export default function AddFoodSheet({
  open,
  meal,
  query,
  setQuery,
  results,
  loading,
  favourites,
  savedMeals = [],
  loadingSavedMeals = false,
  addingSavedMealId = null,
  onAddSavedMeal,
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

  savedMeals?: SavedMeal[];
  loadingSavedMeals?: boolean;
  addingSavedMealId?: string | null;
  onAddSavedMeal?: (meal: string, savedMeal: SavedMeal) => void;

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
  const [gramsTouched, setGramsTouched] = useState(false);
  const [showAllFavs, setShowAllFavs] = useState(false);
  const [showAllSavedMeals, setShowAllSavedMeals] = useState(false);

  const lastFoodKeyRef = useRef<string | null>(null);
  const lastAcceptedGramsRef = useRef<number>(100);

  const qTrim = query.trim();
  const qNorm = normaliseSearch(query);
  const inSearchMode = qTrim.length >= 1;

  const filteredSavedMeals = useMemo(() => {
    const list = Array.isArray(savedMeals) ? savedMeals : [];

    const filtered = qNorm
      ? list.filter((savedMeal) => {
          const haystack = [
            savedMeal.name,
            savedMeal.source_meal,
            savedMeal.item_count,
            savedMeal.totals?.calories,
            savedMeal.totals?.protein,
            savedMeal.totals?.carbs,
            savedMeal.totals?.fat,
          ]
            .join(" ")
            .toLowerCase();

          return haystack.includes(qNorm);
        })
      : list;

    return filtered.slice(0, showAllSavedMeals ? 50 : 8);
  }, [savedMeals, qNorm, showAllSavedMeals]);

  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!selectedFood) return;

    const foodKey = String(selectedFood.id || selectedFood.code || selectedFood.name || "");
    if (!foodKey) return;

    if (lastFoodKeyRef.current !== foodKey) {
      lastFoodKeyRef.current = foodKey;
      setGramsTouched(false);

      if (String(selectedFood.id || "").startsWith("manual-")) {
        setGrams(100);
        lastAcceptedGramsRef.current = 100;
        return;
      }

      const servingGrams = parseServingGrams(selectedFood.servingSize);
      const next = clampGrams(servingGrams && servingGrams > 0 ? servingGrams : 100);

      setGrams(next);
      lastAcceptedGramsRef.current = next;
    }
  }, [selectedFood]);

  useEffect(() => {
    if (inSearchMode) {
      setShowAllFavs(false);
      setShowAllSavedMeals(false);
    }
  }, [inSearchMode]);

  const servingG = useMemo(() => {
    if (!selectedFood) return null;
    return parseServingGrams(selectedFood.servingSize);
  }, [selectedFood]);

  const chips = useMemo(() => [25, 50, 75, 100], []);
  const sheetTitle = meal ? `Add to ${meal}` : "Add food";

  const favsCompact = useMemo(() => favourites.slice(0, 10), [favourites]);
  const favsToShow = showAllFavs ? favourites : favsCompact;

  const isManual = Boolean(selectedFood && String(selectedFood.id || "").startsWith("manual-"));

  function setGramsSafe(next: number, source: "chip" | "editor" | "init") {
    const value = clampGrams(next);

    if (value === grams) return;

    if (source === "editor" && gramsTouched) return;

    setGrams(value);
    lastAcceptedGramsRef.current = value;

    if (source === "chip" || source === "editor") {
      setGramsTouched(true);
    }
  }

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
          maxHeight: "85vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          className="ia-tile ia-tile-pad"
          style={{
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            background: "#0b0f14",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div style={{ minWidth: 0 }}>
              <div className="ia-tile-title">{sheetTitle}</div>
              <div className="text-dim small">
                Search foods or add one of your saved meals.
              </div>
            </div>

            <button
              className="ia-btn ia-btn-outline"
              onClick={onClose}
              style={{ borderRadius: 999, minWidth: 40, minHeight: 40, padding: 0 }}
              aria-label="Close"
              type="button"
            >
              ✕
            </button>
          </div>

          {selectedFood ? (
            <>
              {!isManual ? (
                <div className="mb-2">
                  <div className="ia-kicker mb-1">Amount</div>

                  <div className="d-flex flex-wrap" style={{ gap: 8 }}>
                    {chips.map((g) => (
                      <button
                        key={g}
                        type="button"
                        className={
                          Math.round(grams) === g
                            ? "ia-btn ia-btn-primary"
                            : "ia-btn ia-btn-outline"
                        }
                        style={{ borderRadius: 999, minHeight: 40, padding: "8px 12px" }}
                        onClick={() => setGramsSafe(g, "chip")}
                      >
                        {g}g
                      </button>
                    ))}

                    {servingG ? (
                      <button
                        type="button"
                        className={
                          Math.round(grams) === Math.round(servingG)
                            ? "ia-btn ia-btn-primary"
                            : "ia-btn ia-btn-outline"
                        }
                        style={{ borderRadius: 999, minHeight: 40, padding: "8px 12px" }}
                        onClick={() => setGramsSafe(servingG, "chip")}
                        title={selectedFood.servingSize || "Serving"}
                      >
                        Serving
                      </button>
                    ) : null}

                    {!chips.includes(Math.round(grams)) &&
                    (!servingG || Math.round(grams) !== Math.round(servingG)) ? (
                      <span className="text-dim small" style={{ alignSelf: "center", paddingLeft: 6 }}>
                        Custom
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

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
                gramsOverride={!isManual ? grams : null}
                onGramsChange={(g) => setGramsSafe(g, "editor")}
              />
            </>
          ) : (
            <>
              <div className="d-flex gap-2 mb-2">
                <input
                  className="form-control"
                  placeholder="Search foods or saved meals…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{
                    minHeight: 44,
                    background: "#0b0f14",
                    color: "#fff",
                    borderColor: "rgba(255,255,255,0.1)",
                  }}
                  autoFocus
                />

                <button
                  type="button"
                  className="ia-btn ia-btn-outline"
                  style={{
                    minHeight: 44,
                    borderRadius: 12,
                    borderColor: ACCENT,
                    color: ACCENT,
                    whiteSpace: "nowrap",
                  }}
                  onClick={onCreateManual}
                >
                  + Manual
                </button>
              </div>

              {(filteredSavedMeals.length > 0 || loadingSavedMeals) ? (
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <div className="ia-kicker">Your saved meals</div>

                    {!inSearchMode && savedMeals.length > 8 ? (
                      <button
                        type="button"
                        className="ia-btn"
                        style={{ padding: "6px 10px", background: "transparent" }}
                        onClick={() => setShowAllSavedMeals((v) => !v)}
                      >
                        <span style={{ color: ACCENT }}>
                          {showAllSavedMeals ? "Less" : "More"}
                        </span>
                      </button>
                    ) : null}
                  </div>

                  {loadingSavedMeals ? (
                    <div className="text-dim small">Loading saved meals…</div>
                  ) : (
                    <div className="d-flex flex-column" style={{ gap: 8 }}>
                      {filteredSavedMeals.map((savedMeal) => {
                        const totals = savedMeal.totals || {
                          calories: 0,
                          protein: 0,
                          carbs: 0,
                          fat: 0,
                        };

                        const isAdding = addingSavedMealId === savedMeal.id;

                        return (
                          <button
                            key={savedMeal.id}
                            type="button"
                            className="ia-tile"
                            disabled={isAdding}
                            onClick={() => {
                              if (!onAddSavedMeal) return;
                              onAddSavedMeal(meal, savedMeal);
                            }}
                            style={{
                              borderRadius: 14,
                              padding: 12,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.07)",
                              color: "#fff",
                              textAlign: "left",
                              opacity: isAdding ? 0.7 : 1,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                className="ia-tile-title"
                                style={{
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {savedMeal.name}
                              </div>

                              <div className="small text-dim" style={{ lineHeight: 1.25 }}>
                                {savedMeal.item_count || savedMeal.items?.length || 0} items{" "}
                                <span className="text-dim">•</span>{" "}
                                <span style={{ color: COLORS.calories }}>
                                  {fmt0(totals.calories)} kcal
                                </span>{" "}
                                <span className="text-dim">•</span>{" "}
                                <span style={{ color: COLORS.protein }}>
                                  P {fmt0(totals.protein)}
                                </span>{" "}
                                <span style={{ color: COLORS.carbs }}>
                                  C {fmt0(totals.carbs)}
                                </span>{" "}
                                <span style={{ color: COLORS.fat }}>
                                  F {fmt0(totals.fat)}
                                </span>
                              </div>
                            </div>

                            <span
                              className={isAdding ? "ia-btn ia-btn-muted" : "ia-btn ia-btn-primary"}
                              style={{ minHeight: 34, flex: "0 0 auto" }}
                            >
                              {isAdding ? "Adding…" : "+ Add"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}

              {!inSearchMode && favourites.length > 0 ? (
                <div className="mb-3">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <div className="ia-kicker">Favourites</div>

                    {favourites.length > 10 ? (
                      <button
                        type="button"
                        className="ia-btn"
                        style={{ padding: "6px 10px", background: "transparent" }}
                        onClick={() => setShowAllFavs((v) => !v)}
                      >
                        <span style={{ color: ACCENT }}>{showAllFavs ? "Less" : "More"}</span>
                      </button>
                    ) : null}
                  </div>

                  {!showAllFavs ? (
                    <div
                      className="d-flex"
                      style={{
                        gap: 8,
                        overflowX: "auto",
                        WebkitOverflowScrolling: "touch",
                        paddingBottom: 4,
                      }}
                    >
                      {favsToShow.map((f) => (
                        <button
                          key={(f.id || f.code || f.name) + "-fav"}
                          type="button"
                          className="ia-btn"
                          style={{
                            minHeight: 40,
                            borderRadius: 999,
                            border: `1px solid ${ACCENT}55`,
                            background: "rgba(255,255,255,0.04)",
                            whiteSpace: "nowrap",
                          }}
                          onClick={() => onSelectFood(f)}
                          title="Use favourite"
                        >
                          ⭐ {f.name || f.code || "Food"}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="d-flex flex-wrap" style={{ gap: 8 }}>
                      {favsToShow.map((f) => (
                        <button
                          key={(f.id || f.code || f.name) + "-fav-all"}
                          type="button"
                          className="ia-btn"
                          style={{
                            minHeight: 40,
                            borderRadius: 999,
                            border: `1px solid ${ACCENT}55`,
                            background: "rgba(255,255,255,0.04)",
                          }}
                          onClick={() => onSelectFood(f)}
                          title="Use favourite"
                        >
                          ⭐ {f.name || f.code || "Food"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {qTrim.length >= 2 ? (
                <div className="mb-2">
                  {loading ? (
                    <div className="text-dim small">Searching foods…</div>
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
                            className="ia-tile"
                            style={{
                              borderRadius: 14,
                              padding: 12,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 10,
                              background: "#0b0f14",
                              border: "1px solid rgba(255,255,255,0.06)",
                            }}
                          >
                            <button
                              type="button"
                              className="btn btn-link text-start p-0"
                              style={{
                                color: "#fff",
                                textDecoration: "none",
                                flex: 1,
                                minWidth: 0,
                              }}
                              onClick={() => onSelectFood(food)}
                            >
                              <div
                                className="fw-semibold"
                                style={{
                                  lineHeight: 1.2,
                                  fontSize: 14,
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
                                  {fmt0(food.calories)} kcal
                                </span>
                                <span className="text-dim"> /100g</span>
                              </div>
                            </button>

                            <button
                              type="button"
                              className="ia-btn ia-btn-outline"
                              style={{
                                borderRadius: 999,
                                minHeight: 40,
                                minWidth: 40,
                                padding: 0,
                              }}
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
              ) : null}

              <BarcodeScannerGate isPremium={isPremium} onScanRequested={onScanRequested} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
