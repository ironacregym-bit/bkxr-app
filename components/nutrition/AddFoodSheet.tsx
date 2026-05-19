// File: components/nutrition/AddFoodSheet.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FoodEditor, { Food } from "./FoodEditor";
import BarcodeScannerGate from "./BarcodeScannerGate";
import { NUTRITION_ACCENT as ACCENT, NUTRITION_COLORS as COLORS } from "./nutritionTheme";

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

function clampGrams(n: number) {
  if (!Number.isFinite(n)) return 0;
  // reasonable bounds to stop nonsense and reduce loops
  return Math.max(0, Math.min(5000, Math.round(n)));
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
  // ✅ Use a single number source of truth
  const [grams, setGrams] = useState<number>(100);

  // ✅ Track whether user has intentionally changed grams in this sheet session
  // When true, we stop auto-resetting grams due to selection changes or FoodEditor normalisation.
  const [gramsTouched, setGramsTouched] = useState(false);

  const lastFoodKeyRef = useRef<string | null>(null);
  const lastAcceptedGramsRef = useRef<number>(100);

  const [showAllFavs, setShowAllFavs] = useState(false);

  const qTrim = query.trim();
  const inSearchMode = qTrim.length >= 1;

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

  // ✅ Initialise grams once per selected food (do not keep forcing it)
  useEffect(() => {
    if (!selectedFood) return;

    const foodKey = String(selectedFood.id || selectedFood.code || selectedFood.name || "");
    if (!foodKey) return;

    // When switching to a new food, reset gramsTouched and pick a sensible default
    if (lastFoodKeyRef.current !== foodKey) {
      lastFoodKeyRef.current = foodKey;
      setGramsTouched(false);

      if (String(selectedFood.id || "").startsWith("manual-")) {
        setGrams(100);
        lastAcceptedGramsRef.current = 100;
        return;
      }

      const g = parseServingGrams(selectedFood.servingSize);
      const next = clampGrams(g && g > 0 ? g : 100);
      setGrams(next);
      lastAcceptedGramsRef.current = next;
    }
  }, [selectedFood]);

  useEffect(() => {
    if (inSearchMode) setShowAllFavs(false);
  }, [inSearchMode]);

  const servingG = useMemo(() => {
    if (!selectedFood) return null;
    return parseServingGrams(selectedFood.servingSize);
  }, [selectedFood]);

  const chips = useMemo(() => [25, 50, 75, 100], []);
  const sheetTitle = meal ? `Add food to ${meal}` : "Add food";

  const favsCompact = useMemo(() => favourites.slice(0, 10), [favourites]);
  const favsToShow = showAllFavs ? favourites : favsCompact;

  const isManual = Boolean(selectedFood && String(selectedFood.id || "").startsWith("manual-"));

  // ✅ Central setter to avoid loops / flicker
  function setGramsSafe(next: number, source: "chip" | "editor" | "init") {
    const v = clampGrams(next);

    // ignore no-op updates
    if (v === grams) return;

    // If FoodEditor is firing normalisation updates repeatedly (common cause of flicker),
    // only accept them if user hasn't actively set grams.
    if (source === "editor" && gramsTouched) return;

    setGrams(v);
    lastAcceptedGramsRef.current = v;

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
        {/* ✅ Fully opaque surface for readability */}
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
            <div className="ia-tile-title">{sheetTitle}</div>

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
              {/* Grams chips (non-manual only) */}
              {!isManual && (
                <div className="mb-2">
                  <div className="ia-kicker mb-1">Amount</div>

                  <div className="d-flex flex-wrap" style={{ gap: 8 }}>
                    {chips.map((g) => (
                      <button
                        key={g}
                        type="button"
                        className={Math.round(grams) === g ? "ia-btn ia-btn-primary" : "ia-btn ia-btn-outline"}
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

                    {/* Optional subtle “Custom” indicator when user typed something that doesn't match a chip */}
                    {!chips.includes(Math.round(grams)) && (!servingG || Math.round(grams) !== Math.round(servingG)) ? (
                      <span className="text-dim small" style={{ alignSelf: "center", paddingLeft: 6 }}>
                        Custom
                      </span>
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
                gramsOverride={!isManual ? grams : null}
                onGramsChange={(g) => setGramsSafe(g, "editor")}
              />
            </>
          ) : (
            <>
              {/* Search row */}
              <div className="d-flex gap-2 mb-2">
                <input
                  className="form-control"
                  placeholder="Search foods…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ minHeight: 44, background: "#0b0f14", color: "#fff", borderColor: "rgba(255,255,255,0.1)" }}
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

              {/* Favourites */}
              {!inSearchMode && favourites.length > 0 && (
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
              )}

              {/* Results */}
              {qTrim.length >= 2 && (
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
                                <span style={{ color: COLORS.calories }}>{fmt0(food.calories)} kcal</span>
                                <span className="text-dim"> /100g</span>
                              </div>
                            </button>

                            <button
                              type="button"
                              className="ia-btn ia-btn-outline"
                              style={{ borderRadius: 999, minHeight: 40, minWidth: 40, padding: 0 }}
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
