// components/iron-acre/IronAcreNutritionCard.tsx
"use client";

import Link from "next/link";

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
  href?: string;
};

export default function IronAcreNutritionCard({
  nutritionToday,
  href = "/nutrition-home",
}: IronAcreNutritionCardProps) {
  const calories = Number(nutritionToday?.calories || 0);
  const protein = Number(nutritionToday?.protein_g || 0);
  const carbs = Number(nutritionToday?.carbs_g || 0);
  const fat = Number(nutritionToday?.fat_g || 0);
  const entriesCount = Number(nutritionToday?.entriesCount || 0);
  const logged = Boolean(nutritionToday?.logged);

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
        <div className="ia-page-title" style={{ fontSize: "1.2rem" }}>
          {logged ? "Today’s intake" : "Start logging your meals"}
        </div>
      </div>

      <div className="text-dim small mt-1" style={{ maxWidth: 560 }}>
        {logged
          ? "Quick snapshot of what you’ve logged today."
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
          <div style={{ color: "var(--ia-neon)", fontWeight: 700, fontSize: "1.05rem" }}>
            {Math.round(calories)}
          </div>
          <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
            KCAL
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ color: "var(--ia-neon2)", fontWeight: 700, fontSize: "1.05rem" }}>
            {Math.round(protein)}g
          </div>
          <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
            PROTEIN
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ color: "var(--ia-neon)", fontWeight: 700, fontSize: "1.05rem" }}>
            {Math.round(carbs)}g
          </div>
          <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
            CARBS
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ color: "var(--ia-neon2)", fontWeight: 700, fontSize: "1.05rem" }}>
            {Math.round(fat)}g
          </div>
          <div className="text-dim" style={{ fontSize: ".75rem", letterSpacing: 0.6 }}>
            FAT
          </div>
        </div>
      </div>

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
