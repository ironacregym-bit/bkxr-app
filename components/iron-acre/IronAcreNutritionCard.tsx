// components/iron-acre/IronAcreNutritionCard.tsx
"use client";

import Link from "next/link";
import { useMemo } from "react";

type NutritionToday = {
  logged: boolean;
  entriesCount: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

type IronAcreNutritionCardProps = {
  nutritionToday: NutritionToday;
  targetCalories?: number | null;
  targetProtein?: number | null;
  targetCarbs?: number | null;
  targetFat?: number | null;
  href?: string;
};

function clampPct(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function metricRemaining(target?: number | null, current?: number | null) {
  if (!Number.isFinite(Number(target))) return null;
  return Math.max(0, Number(target) - Number(current || 0));
}

export default function IronAcreNutritionCard({
  nutritionToday,
  targetCalories = null,
  targetProtein = null,
  targetCarbs = null,
  targetFat = null,
  href = "/nutrition-home",
}: IronAcreNutritionCardProps) {
  const calories = Number(nutritionToday?.calories || 0);
  const protein = Number(nutritionToday?.protein_g || 0);
  const carbs = Number(nutritionToday?.carbs_g || 0);
  const fat = Number(nutritionToday?.fat_g || 0);
  const entriesCount = Number(nutritionToday?.entriesCount || 0);
  const logged = Boolean(nutritionToday?.logged);

  const caloriesPct = useMemo(() => {
    if (!Number.isFinite(Number(targetCalories)) || Number(targetCalories) <= 0) return 0;
    return clampPct((calories / Number(targetCalories)) * 100);
  }, [calories, targetCalories]);

  const proteinPct = useMemo(() => {
    if (!Number.isFinite(Number(targetProtein)) || Number(targetProtein) <= 0) return 0;
    return clampPct((protein / Number(targetProtein)) * 100);
  }, [protein, targetProtein]);

  const carbsPct = useMemo(() => {
    if (!Number.isFinite(Number(targetCarbs)) || Number(targetCarbs) <= 0) return 0;
    return clampPct((carbs / Number(targetCarbs)) * 100);
  }, [carbs, targetCarbs]);

  const fatPct = useMemo(() => {
    if (!Number.isFinite(Number(targetFat)) || Number(targetFat) <= 0) return 0;
    return clampPct((fat / Number(targetFat)) * 100);
  }, [fat, targetFat]);

  const caloriesRemaining = metricRemaining(targetCalories, calories);
  const proteinRemaining = metricRemaining(targetProtein, protein);
  const carbsRemaining = metricRemaining(targetCarbs, carbs);
  const fatRemaining = metricRemaining(targetFat, fat);

  const hasTargets =
    Number.isFinite(Number(targetCalories)) ||
    Number.isFinite(Number(targetProtein)) ||
    Number.isFinite(Number(targetCarbs)) ||
    Number.isFinite(Number(targetFat));

  return (
    <section className="ia-tile ia-tile-pad mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="ia-kicker">
          <i className="fas fa-utensils" style={{ color: "var(--ia-neon2)" }} />
          TODAY’S NUTRITION
        </div>

        <span
          className="ia-badge"
          style={{
            background: logged ? "rgba(36,255,160,0.10)" : "rgba(255,255,255,0.06)",
            border: logged
              ? "1px solid rgba(36,255,160,0.24)"
              : "1px solid rgba(255,255,255,0.10)",
            color: logged ? "#d8fff1" : "rgba(255,255,255,0.82)",
          }}
        >
          {logged ? `${entriesCount} logged` : "Nothing logged yet"}
        </span>
      </div>

      <div className="d-flex justify-content-between align-items-start gap-2">
        <div className="ia-page-title" style={{ fontSize: "1.25rem" }}>
          {logged ? "Today’s intake" : "Start logging your meals"}
        </div>
      </div>

      <div className="text-dim small mt-1" style={{ maxWidth: 560 }}>
        {logged
          ? "See what you’ve logged so far today and what’s still left against your targets."
          : "Log meals, track macros and keep your nutrition aligned with your training."}
      </div>

      <div
        className="d-flex justify-content-between text-center mt-3"
        style={{
          gap: 10,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 14,
          padding: "10px 12px",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ color: "var(--ia-neon)", fontWeight: 650, fontSize: "1.05rem" }}>
            {Math.round(calories)}
          </div>
          <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
            KCAL
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ color: "var(--ia-neon2)", fontWeight: 650, fontSize: "1.05rem" }}>
            {Math.round(protein)}g
          </div>
          <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
            PROTEIN
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ color: "var(--ia-neon)", fontWeight: 650, fontSize: "1.05rem" }}>
            {Math.round(carbs)}g
          </div>
          <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
            CARBS
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ color: "var(--ia-neon2)", fontWeight: 650, fontSize: "1.05rem" }}>
            {Math.round(fat)}g
          </div>
          <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
            FAT
          </div>
        </div>
      </div>

      {hasTargets ? (
        <div className="mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <div className="fw-semibold">Calories</div>
                  <div className="small text-dim">
                    {caloriesRemaining != null ? `${Math.round(caloriesRemaining)} left` : "No target"}
                  </div>
                </div>

                <div
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${caloriesPct}%`,
                      height: "100%",
                      background: "var(--ia-neon)",
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <div className="fw-semibold">Protein</div>
                  <div className="small text-dim">
                    {proteinRemaining != null ? `${Math.round(proteinRemaining)}g left` : "No target"}
                  </div>
                </div>

                <div
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${proteinPct}%`,
                      height: "100%",
                      background: "var(--ia-neon2)",
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <div className="fw-semibold">Carbs</div>
                  <div className="small text-dim">
                    {carbsRemaining != null ? `${Math.round(carbsRemaining)}g left` : "No target"}
                  </div>
                </div>

                <div
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${carbsPct}%`,
                      height: "100%",
                      background: "var(--ia-neon)",
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="col-12 col-md-6">
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.04)",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <div className="fw-semibold">Fat</div>
                  <div className="small text-dim">
                    {fatRemaining != null ? `${Math.round(fatRemaining)}g left` : "No target"}
                  </div>
                </div>

                <div
                  style={{
                    height: 8,
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${fatPct}%`,
                      height: "100%",
                      background: "var(--ia-neon2)",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-3">
        <Link href={href} className="ia-btn ia-btn-primary w-100">
          OPEN NUTRITION <i className="fas fa-arrow-right" style={{ marginLeft: 10 }} />
        </Link>

        <div className="text-dim small mt-2">
          {logged
            ? `Logged today: ${entriesCount} entr${entriesCount === 1 ? "y" : "ies"}`
            : "No meals logged yet today"}
        </div>
      </div>
    </section>
  );
}
