// pages/api/foods/lookup-barcode.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

/* ------------------- Config toggles ------------------- */
const STRICT_GTIN_CHECK = false; // set true to hard-fail on invalid checksums
const ENABLE_OFF_FALLBACK = true; // Open Food Facts fallback

/* ------------------- Utilities ------------------- */
function digits(s: string) {
  return String(s || "").replace(/\D/g, "");
}
function toNum(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}
/** Tolerant grams parser: "40", "40g", "40 g", "(40g)", "(40 g)", "1 bar (40g)" */
function parseServingGrams(servingSize?: string | null): number | null {
  if (servingSize == null) return null;
  const raw = String(servingSize).trim();
  if (!raw) return null;
  if (/^\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const m1 = raw.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (m1) {
    const n = Number(m1[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const m2 = raw.match(/\((\d+(?:\.\d+)?)\s*g\)/i);
  if (m2) {
    const n = Number(m2[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/* ------------------- GTIN / EAN / UPC checksum helpers ------------------- */
function isValidEAN13(d: string) {
  if (d.length !== 13) return false;
  const sum = d.slice(0, 12).split("").reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(d[12]);
}
function isValidEAN8(d: string) {
  if (d.length !== 8) return false;
  const sum = d.slice(0, 7).split("").reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 3 : 1), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(d[7]);
}
function isValidUPCA(d: string) { // GTIN-12
  if (d.length !== 12) return false;
  const odds = d.slice(0, 11).split("").reduce((acc, ch, i) => acc + (i % 2 === 0 ? Number(ch) : 0), 0);
  const evens = d.slice(0, 11).split("").reduce((acc, ch, i) => acc + (i % 2 === 1 ? Number(ch) : 0), 0);
  const sum = odds * 3 + evens;
  const check = (10 - (sum % 10)) % 10;
  return check === Number(d[11]);
}
function isValidEAN14(d: string) {
  if (d.length !== 14) return false;
  const sum = d.slice(0, 13).split("").reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 3 : 1), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === Number(d[13]);
}
function validGtin(d: string) {
  return isValidEAN8(d) || isValidUPCA(d) || isValidEAN13(d) || isValidEAN14(d);
}

/* ------------------- DTO ------------------- */
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

/* ------------------- Normaliser: Firestore global doc -> DTO ------------------- */
function fromFirestoreDoc(code: string, d: any): FoodDTO {
  const name = String(d?.name || code);
  const brand = String(d?.brand || "");
  const image = d?.image ? String(d.image) : null;
  const servingSize: string | null = d?.servingSize != null ? String(d.servingSize) : null;

  const g = parseServingGrams(servingSize);

  // Preferred explicit blocks
  const per100 = d?.per100 || {};
  const perServing = d?.perServing || {};
  const hasPer100Block =
    per100 && (per100.calories != null || per100.protein != null || per100.carbs != null || per100.fat != null);
  const hasPerServingBlock =
    perServing && (perServing.calories != null || perServing.protein != null || perServing.carbs != null || perServing.fat != null);

  // Legacy shapes/flags
  const hasPer100Flat =
    d?.calories_100g != null || d?.protein_100g != null || d?.carbs_100g != null || d?.fat_100g != null;
  const hasPerServingFlat =
    d?.caloriesPerServing != null || d?.proteinPerServing != null || d?.carbsPerServing != null || d?.fatPerServing != null;
  const hasPer100Flag = d?.basis === "per100" || d?.per100g === true;
  const hasServingFlag = d?.basis === "perServing" || d?.perServing === true;
  const hasBase = d?.calories != null || d?.protein != null || d?.carbs != null || d?.fat != null;

  let c100 = 0, p100 = 0, ch100 = 0, f100 = 0;
  let cServ: number | null = null, pServ: number | null = null, chServ: number | null = null, fServ: number | null = null;

  // Prefer explicit per100
  if (hasPer100Block || hasPer100Flat || hasPer100Flag) {
    c100 = toNum(per100.calories ?? d?.calories_100g ?? (hasPer100Flag ? d?.calories : undefined));
    p100 = toNum(per100.protein ?? d?.protein_100g ?? (hasPer100Flag ? d?.protein : undefined));
    ch100 = toNum(per100.carbs ?? d?.carbs_100g ?? (hasPer100Flag ? d?.carbs : undefined));
    f100 = toNum(per100.fat ?? d?.fat_100g ?? (hasPer100Flag ? d?.fat : undefined));
  }

  // Then explicit perServing
  if (hasPerServingBlock || hasPerServingFlat || hasServingFlag) {
    cServ = toNum(perServing.calories ?? d?.caloriesPerServing ?? (hasServingFlag ? d?.calories : undefined));
    pServ = toNum(perServing.protein ?? d?.proteinPerServing ?? (hasServingFlag ? d?.protein : undefined));
    chServ = toNum(perServing.carbs ?? d?.carbsPerServing ?? (hasServingFlag ? d?.carbs : undefined));
    fServ = toNum(perServing.fat ?? d?.fatPerServing ?? (hasServingFlag ? d?.fat : undefined));
  }

  // Ambiguous legacy base + grams => treat base as per-serving and derive per100
  if (!hasPer100Block && !hasPer100Flat && !hasPer100Flag && !hasPerServingBlock && !hasPerServingFlat && !hasServingFlag) {
    if (hasBase) {
      if (g && g > 0) {
        cServ = toNum(d?.calories);
        pServ = toNum(d?.protein);
        chServ = toNum(d?.carbs);
        fServ = toNum(d?.fat);
        const scale = 100 / g;
        c100 = +(toNum(d?.calories) * scale).toFixed(2);
        p100 = +(toNum(d?.protein) * scale).toFixed(2);
        ch100 = +(toNum(d?.carbs) * scale).toFixed(2);
        f100 = +(toNum(d?.fat) * scale).toFixed(2);
      } else {
        // No grams => assume per-100g legacy base
        c100 = toNum(d?.calories);
        p100 = toNum(d?.protein);
        ch100 = toNum(d?.carbs);
        f100 = toNum(d?.fat);
      }
    }
  }

  // If we have per-serving & grams but no per100 yet, derive it now
  if ((cServ != null || pServ != null || chServ != null || fServ != null) && g && g > 0) {
    if (c100 === 0 && p100 === 0 && ch100 === 0 && f100 === 0) {
      c100 = +((toNum(cServ) * 100) / g).toFixed(2);
      p100 = +((toNum(pServ) * 100) / g).toFixed(2);
      ch100 = +((toNum(chServ) * 100) / g).toFixed(2);
      f100 = +((toNum(fServ) * 100) / g).toFixed(2);
    }
  }

  return {
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
}

/* ------------------- Fallback mappers ------------------- */
/** OFF -> DTO normaliser */
function fromOFF(code: string, off: any): FoodDTO | null {
  // OFF product payload
  const p = off?.product;
  if (!p) return null;

  // Names & image
  const name = String(p.product_name || p.product_name_en || code);
  const brand = String(p.brands || p.brands_tags?.join(", ") || "");
  const image = p.image_url ? String(p.image_url) : null;

  // Serving size text and grams parse
  const servingSize: string | null = p.serving_size ? String(p.serving_size) : null;
  const g = parseServingGrams(servingSize);

  // Nutriments
  const n = p.nutriments || {};
  // OFF provides *_100g and *_serving; energy sometimes in kJ. Prefer energy-kcal fields.
  const kcal100 = toNum(n["energy-kcal_100g"] ?? n["energy_100g"]); // energy_100g can be kJ; OFF often also sets kcal_100g; if not, we leave as-is
  const prot100 = toNum(n["proteins_100g"]);
  const carbs100 = toNum(n["carbohydrates_100g"]);
  const fat100 = toNum(n["fat_100g"]);

  const kcalServ = toNum(n["energy-kcal_serving"] ?? n["energy_serving"]);
  const protServ = toNum(n["proteins_serving"]);
  const carbsServ = toNum(n["carbohydrates_serving"]);
  const fatServ = toNum(n["fat_serving"]);

  // Build baseline per-100g, with derivation if only serving has values + grams known
  let c100 = kcal100, p100 = prot100, ch100 = carbs100, f100 = fat100;
  let cServ: number | null = kcalServ || null,
    pServ: number | null = protServ || null,
    chServ: number | null = carbsServ || null,
    fServ: number | null = fatServ || null;

  const has100 =
    (c100 && c100 > 0) || (p100 && p100 > 0) || (ch100 && ch100 > 0) || (f100 && f100 > 0);
  const hasServ =
    (cServ && cServ > 0) || (pServ && pServ > 0) || (chServ && chServ > 0) || (fServ && fServ > 0);

  if (!has100 && hasServ && g && g > 0) {
    c100 = +((toNum(cServ) * 100) / g).toFixed(2);
    p100 = +((toNum(pServ) * 100) / g).toFixed(2);
    ch100 = +((toNum(chServ) * 100) / g).toFixed(2);
    f100 = +((toNum(fServ) * 100) / g).toFixed(2);
  }

  return {
    id: code,
    code,
    name,
    brand,
    image,
    calories: c100 || 0,
    protein: p100 || 0,
    carbs: ch100 || 0,
    fat: f100 || 0,
    servingSize: servingSize || "",
    caloriesPerServing: hasServ ? cServ : null,
    proteinPerServing: hasServ ? pServ : null,
    carbsPerServing: hasServ ? chServ : null,
    fatPerServing: hasServ ? fServ : null,
  };
}

/* ------------------- Handler ------------------- */
/**
 * GET /api/foods/lookup-barcode?barcode=CODE
 * Response:
 *   { foods: Food[], normalized?: string }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const raw = String(req.query.barcode || "");
    const code = digits(raw);
    if (!code) return res.status(400).json({ foods: [], normalized: "" });

    // Optional strict validation (EAN-8/UPC-A/EAN-13/EAN-14)
    if (STRICT_GTIN_CHECK && !validGtin(code)) {
      return res.status(400).json({ foods: [], normalized: code, error: "Invalid GTIN" });
    }

    // 1) GLOBAL Firestore
    const snap = await firestore.collection("barcode_foods").doc(code).get();
    if (snap.exists) {
      const d = snap.data() || {};
      const dto = fromFirestoreDoc(code, d);
      return res.status(200).json({ normalized: code, foods: [dto] });
    }

    // 2) Fallback: Open Food Facts
    if (ENABLE_OFF_FALLBACK) {
      try {
        const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`;
        const r = await fetch(url, { method: "GET" });
        if (r.ok) {
          const offJson = await r.json().catch(() => null as any);
          if (offJson && offJson.status === 1) {
            const dto = fromOFF(code, offJson);
            if (dto) {
              // Return OFF data *without* writing to Firestore (read-through cache can be added later)
              // If you want to auto-save to global, add a guarded write here with attribution.
              return res.status(200).json({
                normalized: code,
                foods: [dto],
                source: "openfoodfacts.org", // attribution
              });
            }
          }
        }
      } catch {
        // ignore OFF errors and fall through
      }
    }

    // Not found anywhere
    return res.status(200).json({ foods: [], normalized: code });
  } catch (e: any) {
    console.error("[foods/lookup-barcode] error:", e?.message || e);
    return res.status(500).json({ foods: [], normalized: "" });
  }
}
