// pages/api/foods/lookup-barcode.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

function digits(s: string) {
  return String(s || "").replace(/\D/g, "");
}

function toNum(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function parseServingGrams(servingSize?: string | null): number | null {
  if (!servingSize) return null;
  const m = String(servingSize).match(/(\d+(?:\.\d+)?)\s*g/i);
  if (!m) return null;
  const g = Number(m[1]);
  return Number.isFinite(g) && g > 0 ? g : null;
}

type FoodDTO = {
  id: string;
  code: string;
  name: string;
  brand: string;
  image: string | null;
  calories: number; // per-100g baseline after normalisation
  protein: number;
  carbs: number;
  fat: number;
  servingSize?: string | null;
  caloriesPerServing?: number | null;
  proteinPerServing?: number | null;
  carbsPerServing?: number | null;
  fatPerServing?: number | null;
};

function fromFirestoreDoc(code: string, d: any): FoodDTO {
  // Accept multiple schema variants:
  // - Explicit per100: d.per100 = { calories, protein, carbs, fat } OR *_100g fields
  // - Explicit perServing: d.perServing = {...} OR *PerServing flat fields
  // - Legacy/ambiguous: d.calories/protein/... + servingSize "40g" (assume those are per-serving)
  // - Legacy per100 only: d.calories/protein/... with no serving grams (assume per-100g)
  const name = String(d?.name || code);
  const brand = String(d?.brand || "");
  const image = d?.image ? String(d.image) : null;
  const servingSize: string | null = d?.servingSize != null ? String(d.servingSize) : null;

  const g = parseServingGrams(servingSize);

  // Detect explicit per100
  const per100 = d?.per100 || {};
  const hasPer100Block =
    per100 && (per100.calories != null || per100.protein != null || per100.carbs != null || per100.fat != null);
  const hasPer100Flat =
    d?.calories_100g != null || d?.protein_100g != null || d?.carbs_100g != null || d?.fat_100g != null;
  const hasPer100Flag = d?.basis === "per100" || d?.per100g === true;

  // Detect explicit perServing
  const perServing = d?.perServing || {};
  const hasPerServingBlock =
    perServing && (perServing.calories != null || perServing.protein != null || perServing.carbs != null || perServing.fat != null);
  const hasPerServingFlat =
    d?.caloriesPerServing != null || d?.proteinPerServing != null || d?.carbsPerServing != null || d?.fatPerServing != null;
  const hasServingFlag = d?.basis === "perServing" || d?.perServing === true; // tolerate boolean

  // Legacy base fields
  const hasBase = d?.calories != null || d?.protein != null || d?.carbs != null || d?.fat != null;

  // Prepare holders
  let c100 = 0, p100 = 0, ch100 = 0, f100 = 0;
  let cServ: number | null = null, pServ: number | null = null, chServ: number | null = null, fServ: number | null = null;

  // Priority 1: explicit per100
  if (hasPer100Block || hasPer100Flat || hasPer100Flag) {
    c100 = toNum(per100.calories ?? d?.calories_100g ?? (hasPer100Flag ? d?.calories : undefined));
    p100 = toNum(per100.protein ?? d?.protein_100g ?? (hasPer100Flag ? d?.protein : undefined));
    ch100 = toNum(per100.carbs ?? d?.carbs_100g ?? (hasPer100Flag ? d?.carbs : undefined));
    f100 = toNum(per100.fat ?? d?.fat_100g ?? (hasPer100Flag ? d?.fat : undefined));
  }

  // Priority 2: explicit perServing
  if (hasPerServingBlock || hasPerServingFlat || hasServingFlag) {
    cServ = toNum(perServing.calories ?? d?.caloriesPerServing ?? (hasServingFlag ? d?.calories : undefined));
    pServ = toNum(perServing.protein ?? d?.proteinPerServing ?? (hasServingFlag ? d?.protein : undefined));
    chServ = toNum(perServing.carbs ?? d?.carbsPerServing ?? (hasServingFlag ? d?.carbs : undefined));
    fServ = toNum(perServing.fat ?? d?.fatPerServing ?? (hasServingFlag ? d?.fat : undefined));
  }

  // Priority 3: legacy ambiguous (base fields + parseable serving grams)
  if (!hasPer100Block && !hasPer100Flat && !hasPer100Flag && !hasPerServingBlock && !hasPerServingFlat && !hasServingFlag) {
    if (hasBase && g && g > 0) {
      // Interpret base as per-serving; derive per-100g
      cServ = toNum(d?.calories);
      pServ = toNum(d?.protein);
      chServ = toNum(d?.carbs);
      fServ = toNum(d?.fat);

      const scale = 100 / g;
      c100 = +(toNum(d?.calories) * scale).toFixed(2);
      p100 = +(toNum(d?.protein) * scale).toFixed(2);
      ch100 = +(toNum(d?.carbs) * scale).toFixed(2);
      f100 = +(toNum(d?.fat) * scale).toFixed(2);
    } else if (hasBase) {
      // Treat base as per-100g (no serving grams available)
      c100 = toNum(d?.calories);
      p100 = toNum(d?.protein);
      ch100 = toNum(d?.carbs);
      f100 = toNum(d?.fat);
    }
  }

  // If we have per-serving and grams but no per100 yet, derive it now
  if ((cServ != null || pServ != null || chServ != null || fServ != null) && g && g > 0) {
    if (c100 === 0 && p100 === 0 && ch100 === 0 && f100 === 0) {
      c100 = +((toNum(cServ) * 100) / g).toFixed(2);
      p100 = +((toNum(pServ) * 100) / g).toFixed(2);
      ch100 = +((toNum(chServ) * 100) / g).toFixed(2);
      f100 = +((toNum(fServ) * 100) / g).toFixed(2);
    }
  }

  // Build DTO
  const dto: FoodDTO = {
    id: code,
    code,
    name,
    brand,
    image,
    calories: c100,
    protein: p100,
    carbs: ch100,
    fat: f100,
    servingSize: servingSize ?? "",
    caloriesPerServing: cServ ?? null,
    proteinPerServing: pServ ?? null,
    carbsPerServing: chServ ?? null,
    fatPerServing: fServ ?? null,
  };

  return dto;
}

/**
 * GET /api/foods/lookup-barcode?barcode=CODE
 * Response:
 *   { foods: Food[], normalized?: string }
 *   - normalized: digits-only code echo, for prefilling quick-add
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const raw = String(req.query.barcode || "");
    const code = digits(raw);
    if (!code) return res.status(400).json({ foods: [], normalized: "" });

    const session = await getServerSession(req, res, authOptions);
    const email = String(session?.user?.email || "").toLowerCase();

    // 1) user override
    if (email) {
      const us = await firestore
        .collection("user_barcode_foods")
        .doc(email)
        .collection("foods")
        .doc(code)
        .get();
      if (us.exists) {
        const d = us.data() || {};
        const dto = fromFirestoreDoc(code, d);
        return res.status(200).json({ normalized: code, foods: [dto] });
      }
    }

    // 2) global
    const gs = await firestore.collection("barcode_foods").doc(code).get();
    if (gs.exists) {
      const d = gs.data() || {};
      const dto = fromFirestoreDoc(code, d);
      return res.status(200).json({ normalized: code, foods: [dto] });
    }

    // Not found
    return res.status(200).json({ foods: [], normalized: code });
  } catch (e: any) {
    console.error("[foods/lookup-barcode] error:", e?.message || e);
    return res.status(500).json({ foods: [], normalized: "" });
  }
}
