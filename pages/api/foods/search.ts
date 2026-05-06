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
      const calories = toNum(
        p.nutriments?.["energy-kcal_100g"] ?? p.nutriments?.["energy_100g"]
      );
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

function boostSort(foods: Food[]) {
  foods.sort((a, b) => {
    const aScore = (a.image ? 2 : 0) + (/^[\x00-\x7F]*$/.test(a.name) ? 1 : 0);
    const bScore = (b.image ? 2 : 0) + (/^[\x00-\x7F]*$/.test(b.name) ? 1 : 0);
    return bScore - aScore;
  });
  return foods;
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

    // 1) UK + English first (preferred)
    const urlUK =
      `https://world.openfoodfacts.org/cgi/search.pl?` +
      `search_terms=${encodeURIComponent(query)}` +
      `&search_simple=1` +
      `&action=process` +
      `&json=1` +
      `&page_size=30` +
      `&lc=en` +
      `&tags_lc=en` +
      `&countries=United%20Kingdom`;

    const dataUK = await fetchOFF(urlUK);
    const foodsUK = dataUK?.products ? boostSort(mapProducts(dataUK.products, query)) : [];

    if (foodsUK.length > 0) {
      return res.status(200).json({ foods: foodsUK });
    }

    // 2) Fallback: global English
    const urlGlobal =
      `https://world.openfoodfacts.org/cgi/search.pl?` +
      `search_terms=${encodeURIComponent(query)}` +
      `&search_simple=1` +
      `&action=process` +
      `&json=1` +
      `&page_size=30` +
      `&lc=en` +
      `&tags_lc=en`;

    const dataGlobal = await fetchOFF(urlGlobal);
    const foodsGlobal = dataGlobal?.products ? boostSort(mapProducts(dataGlobal.products, query)) : [];

    return res.status(200).json({ foods: foodsGlobal });
  } catch (err) {
    console.error("[foods/search] error:", err);
    return res.status(500).json({ foods: [] });
  }
}
