// components/iron-acre/IronAcreNutritionCard.tsx
"use client";

import Link from "next/link";
import { NUTRITION_COLORS as COLORS } from "../nutrition/nutritionTheme";

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

function fmt0(n: number | undefined | null) {
  return Number.isFinite(Number(n)) ? String(Math.round(Number(n))) : "0";
}

export default function IronAcreNutritionCard({
  nutritionToday,
  href = "/nutrition",
}: IronAcreNutritionCardProps) {
  const calories = Number(nutritionToday?.calories || 0);
  const protein = Number(nutritionToday?.protein_g || 0);
  const carbs = Number(nutritionToday?.carbs_g || 0);
  const fat = Number(nutritionToday?.fat_g || 0);

  return (
    <section className="ia-tile ia-tile-pad mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div className="ia-kicker">
          <i className="fas fa-utensils" />
          TODAY’S NUTRITION
        </div>

        <Link href={href} className="ia-btn ia-btn-primary ia-btn-sm ia-btn-icon-right">
          Open
          <i className="fas fa-arrow-right" />
        </Link>
      </div>

      <div className="ia-card-title-compact">Nutrition</div>

      <div className="ia-stats-row mt-2">
        <div className="ia-stat">
          <div className="ia-stat-value" style={{ color: COLORS.calories }}>
            {fmt0(calories)}
          </div>
          <div className="ia-stat-label">KCAL</div>
        </div>

        <div className="ia-stat">
          <div className="ia-stat-value" style={{ color: COLORS.protein }}>
            {fmt0(protein)}g
          </div>
          <div className="ia-stat-label">PROTEIN</div>
        </div>

        <div className="ia-stat">
          <div className="ia-stat-value" style={{ color: COLORS.carbs }}>
            {fmt0(carbs)}g
          </div>
          <div className="ia-stat-label">CARBS</div>
        </div>

        <div className="ia-stat">
          <div className="ia-stat-value" style={{ color: COLORS.fat }}>
            {fmt0(fat)}g
          </div>
          <div className="ia-stat-label">FAT</div>
        </div>
      </div>
    </section>
  );
}
