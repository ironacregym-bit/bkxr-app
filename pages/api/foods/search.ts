// File: pages/api/foods/search.ts
import type { NextApiRequest, NextApiResponse } from "next";

type Food = {
  id: string;
  code: string;
  name: string;
  brand: string;
  image: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

function toNum(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function pickName(p: any, fallback: string) {
  // Prefer explicit English fields if present, then generic fields
  return (
    String(p?.product_name_en || "").trim() ||
    String(p?.product_name || "").trim() ||
    String(p?.generic_name_en || "").trim() ||
    String(p?.generic_name || "").trim() ||
    fallback
  );
}

function mapProducts(products: any[], fallbackQuery: string): Food[] {
  return (products || [])
    .filter((p: any) => p?.nutriments)
    .map((p: any) => {
      const calories = toNum(p.nutriments?.["energy-kcal_100g"] ?? p.nutriments?.["energy_100g"]);
      return {
        id: String(p.code),
        code: String(p.code),
        name: pickName(p, fallbackQuery),
        brand: String(p.brands || "Unknown"),
        image: p.image_front_small_url || p.image_front_url || null,
        calories,
        protein: toNum(p.nutriments?.proteins_100g),
        carbs: toNum(p.nutriments?.carbohydrates_100g),
        fat: toNum(p.nutriments?.fat_100g),
      };
    });
}

async function fetchOFF(url: string) {
  const r = await fetch(url, {
    headers: {
      "Accept-Language": "en-GB,en;q=0.9",
      "User-Agent": "BXKR/1.0 (nutrition-search)",
    },
  });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

// Heuristics to rank “English/UK-ish” items higher
function scoreProduct(p: any, mapped: Food) {
  let score = 0;

  const nameEn = String(p?.product_name_en || "").trim();
  const genericEn = String(p?.generic_name_en || "").trim();
  const hasEnglishField = Boolean(nameEn || genericEn);

  if (hasEnglishField) score += 8;

  // Prefer items tagged as being sold in UK
  const countries = Array.isArray(p?.countries_tags) ? p.countries_tags.join(" ") : String(p?.countries_tags || "");
  if (/united-kingdom|en:united-kingdom|gb/i.test(countries)) score += 8;

  // Prefer english language tags
  const langs = Array.isArray(p?.languages_tags) ? p.languages_tags.join(" ") : String(p?.languages_tags || "");
  if (/\ben:english\b|\ben\b/i.test(langs)) score += 4;

  // Prefer ASCII-only names (often English; not perfect but effective)
  if (/^[\x00-\x7F]*$/.test(mapped.name)) score += 2;

  // Penalise common French/Spanish/Portuguese terms that dominate “chicken” results
  const n = mapped.name.toLowerCase();
  const penalties = [
    "blanc", "poulet", "dinde", "jambon", "rôti", "charcuterie",
    "pollo", "pechuga", "frango", "filet", "nature", "sans nitrite",
  ];
  for (const w of penalties) {
    if (n.includes(w)) score -= 1;
  }

  // Prefer useful metadata (image + brand)
  if (mapped.image) score += 1;
  if (mapped.brand && mapped.brand !== "Unknown") score += 1;

  // Prefer closer match to query tokens
  // (helps “chicken breast” prefer “chicken breast” over “blanc de poulet”)
  // This is intentionally light: don’t overfit.
  // We apply this in the main sort where we have query tokens.

  return score;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = String(req.query.query || "").trim();
  const barcode = String(req.query.barcode || "").trim();

  try {
    // Barcode lookup takes precedence
    if (barcode && barcode.length >= 6) {
      const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
      const data = await fetchOFF(url);

      if (!data || data.status !== 1 || !data.product || !data.product.nutriments) {
        return res.status(200).json({ foods: [] });
      }

      const p = data.product;
      const calories = toNum(p.nutriments?.["energy-kcal_100g"] ?? p.nutriments?.["energy_100g"]);

      const food: Food = {
        id: String(p.code),
        code: String(p.code),
        name: pickName(p, "Unknown"),
        brand: String(p.brands || "Unknown"),
        image: p.image_front_small_url || p.image_front_url || null,
        calories,
        protein: toNum(p.nutriments?.proteins_100g),
        carbs: toNum(p.nutriments?.carbohydrates_100g),
        fat: toNum(p.nutriments?.fat_100g),
      };

      return res.status(200).json({ foods: [food] });
    }

    if (!query || query.length < 2) return res.status(200).json({ foods: [] });

    // 1) UK + English first
    const urlUK =
      `https://world.openfoodfacts.org/cgi/search.pl?` +
      `search_terms=${encodeURIComponent(query)}` +
      `&search_simple=1&action=process&json=1&page_size=30` +
      `&lc=en&tags_lc=en&countries=United%20Kingdom`;

    const dataUK = await fetchOFF(urlUK);
    const productsUK: any[] = Array.isArray(dataUK?.products) ? dataUK.products : [];
    const foodsUK = mapProducts(productsUK, query);

    // 2) If too few, also pull global English
    let productsGlobal: any[] = [];
    if (foodsUK.length < 8) {
      const urlGlobal =
        `https://world.openfoodfacts.org/cgi/search.pl?` +
        `search_terms=${encodeURIComponent(query)}` +
        `&search_simple=1&action=process&json=1&page_size=30` +
        `&lc=en&tags_lc=en`;

      const dataGlobal = await fetchOFF(urlGlobal);
      productsGlobal = Array.isArray(dataGlobal?.products) ? dataGlobal.products : [];
    }

    const foodsGlobal = mapProducts(productsGlobal, query);

    // 3) Merge + dedupe by code
    const mergedMap = new Map<string, { food: Food; raw: any }>();

    for (let i = 0; i < productsUK.length; i++) {
      const p = productsUK[i];
      const f = foodsUK[i];
      if (!f?.code) continue;
      if (!mergedMap.has(f.code)) mergedMap.set(f.code, { food: f, raw: p });
    }

    for (let i = 0; i < productsGlobal.length; i++) {
      const p = productsGlobal[i];
      const f = foodsGlobal[i];
      if (!f?.code) continue;
      if (!mergedMap.has(f.code)) mergedMap.set(f.code, { food: f, raw: p });
    }

    const merged = Array.from(mergedMap.values());

    // 4) Rank: UK/English first + query token match
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5);

    merged.sort((A, B) => {
      const aBase = scoreProduct(A.raw, A.food);
      const bBase = scoreProduct(B.raw, B.food);

      const aName = A.food.name.toLowerCase();
      const bName = B.food.name.toLowerCase();

      const aTokenScore = tokens.reduce((acc, t) => acc + (aName.includes(t) ? 1 : 0), 0);
      const bTokenScore = tokens.reduce((acc, t) => acc + (bName.includes(t) ? 1 : 0), 0);

      // token match matters a lot for generic foods
      const aScore = aBase + aTokenScore * 3;
      const bScore = bBase + bTokenScore * 3;

      return bScore - aScore;
    });

    return res.status(200).json({ foods: merged.map((x) => x.food) });
  } catch (err) {
    console.error("[foods/search] error:", err);
    return res.status(500).json({ foods: [] });
  }
}
