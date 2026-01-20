
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

function isYMD(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }

type Macros = { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number; [k: string]: any };
function scaleMacros(per: Macros, mul: number): Macros {
  const out: any = {};
  for (const [k, v] of Object.entries(per || {})) {
    out[k] = typeof v === "number" ? Number((v * mul).toFixed(2)) : v;
  }
  return out;
}

/** Heuristic: best-fit multiplier against residual macros (prioritise protein, then calories) */
function pickMultiplier(per: Required<Macros>, residual: Required<Macros>): number {
  // Avoid divide-by-zero; prefer protein if present
  const candidates: number[] = [];
  if (per.protein_g! > 0 && residual.protein_g! > 0) candidates.push(residual.protein_g! / per.protein_g!);
  if (per.calories! > 0 && residual.calories! > 0) candidates.push(residual.calories! / per.calories!);
  if (per.carbs_g! > 0 && residual.carbs_g! > 0) candidates.push(residual.carbs_g! / per.carbs_g!);
  if (per.fat_g! > 0 && residual.fat_g! > 0) candidates.push(residual.fat_g! / per.fat_g!);

  let m = candidates.length ? Math.min(...candidates) : 1;
  if (!isFinite(m) || m <= 0) m = 1;

  // Clamp to a friendly serving range
  m = Math.max(0.25, Math.min(m, 3)); // quarter to triple serving
  return Number(m.toFixed(2));
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow","POST"); return res.status(405).json({ error: "Method not allowed" }); }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { date, recipeId, meal_type, autoScale } = (req.body || {}) as {
      date: string;
      recipeId: string;
      meal_type: "breakfast"|"lunch"|"dinner"|"snack";
      autoScale?: boolean;
    };
    if (!isYMD(date)) return res.status(400).json({ error: "date (YYYY-MM-DD) required" });
    if (!recipeId) return res.status(400).json({ error: "recipeId required" });
    if (!["breakfast","lunch","dinner","snack"].includes(meal_type)) return res.status(400).json({ error: "meal_type invalid" });

    const recipeSnap = await firestore.collection("recipes").doc(recipeId).get();
    if (!recipeSnap.exists) return res.status(404).json({ error: "Recipe not found" });

    const recipe = recipeSnap.data() as any;
    const per = recipe.per_serving || {};
    const perReq: Required<Macros> = {
      calories: Number(per.calories || 0),
      protein_g: Number(per.protein_g || 0),
      carbs_g: Number(per.carbs_g || 0),
      fat_g: Number(per.fat_g || 0),
    } as any;

    // Read current plan + targets to compute residuals if autoScale
    let multiplier = 1;
    if (autoScale) {
      const dayRef = firestore.collection("meal_plans").doc(email).collection("days").doc(date);
      const itemsSnap = await dayRef.collection("items").get();
      const currentTotals = itemsSnap.docs.reduce((acc, d) => {
        const s = (d.data() as any).scaled || {};
        acc.calories += Number(s.calories || 0);
        acc.protein_g += Number(s.protein_g || 0);
        acc.carbs_g += Number(s.carbs_g || 0);
        acc.fat_g += Number(s.fat_g || 0);
        return acc;
      }, { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

      const userSnap = await firestore.collection("users").doc(email).get();
      const profile = userSnap.exists ? (userSnap.data() as any) : {};
      const caloricTarget = Number(profile.caloric_target || 0) || null;
      const split = profile.macro_split || { protein_pct: 30, carbs_pct: 40, fat_pct: 30 };

      let targets = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
      if (caloricTarget) {
        targets = {
          calories: caloricTarget,
          protein_g: Math.round((split.protein_pct / 100) * caloricTarget / 4),
          carbs_g: Math.round((split.carbs_pct / 100) * caloricTarget / 4),
          fat_g: Math.round((split.fat_pct / 100) * caloricTarget / 9),
        };
      }

      const residual = {
        calories: Math.max(0, targets.calories - currentTotals.calories),
        protein_g: Math.max(0, targets.protein_g - currentTotals.protein_g),
        carbs_g: Math.max(0, targets.carbs_g - currentTotals.carbs_g),
        fat_g: Math.max(0, targets.fat_g - currentTotals.fat_g),
      };

      multiplier = pickMultiplier(perReq, residual);
    }

    const scaled = scaleMacros(perReq, multiplier);

    const dayRef = firestore.collection("meal_plans").doc(email).collection("days").doc(date);
    const itemRef = dayRef.collection("items").doc();
    const nowIso = new Date().toISOString();

    const payload = {
      recipe_id: recipeSnap.id,
      title: recipe.title || "Recipe",
      meal_type,
      image: recipe.image || null,
      multiplier,
      per_serving: perReq,
      scaled,
      added_at: nowIso,
    };

    await itemRef.set(payload, { merge: true });

    return res.status(200).json({ ok: true, item: { id: itemRef.id, ...payload } });
  } catch (e: any) {
    console.error("[mealplan/add]", e?.message || e);
    return res.status(500).json({ error: "Failed to add recipe to plan" });
  }
}
