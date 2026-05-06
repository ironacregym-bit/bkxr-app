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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = String(req.query.query || "").trim();
  const barcode = String(req.query.barcode || "").trim();

  try {
    // Barcode lookup takes precedence
    if (barcode && barcode.length >= 6) {
      const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
      const response = await fetch(url, {
        headers: {
          // Encourage English responses where possible
          "Accept-Language": "en-GB,en;q=0.9",
        },
      });
      if (!response.ok) return res.status(502).json({ foods: [] });
      const data = await response.json();

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

    // Bias to English + UK
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl?` +
      `search_terms=${encodeURIComponent(query)}` +
      `&search_simple=1&action=process&json=1&page_size=30` +
      `&lc=en&tags_lc=en` +
      `&countries=United%20Kingdom`;

    const response = await fetch(url, {
      headers: {
        "Accept-Language": "en-GB,en;q=0.9",
      },
    });

    if (!response.ok) return res.status(502).json({ foods: [] });
    const data = await response.json();

    const foods: Food[] = (data.products || [])
      .filter((p: any) => p?.nutriments)
      .map((p: any) => {
        const calories = toNum(p.nutriments?.["energy-kcal_100g"] ?? p.nutriments?.["energy_100g"]);
        return {
          id: String(p.code),
          code: String(p.code),
          name: pickName(p, query),
          brand: String(p.brands || "Unknown"),
          image: p.image_front_small_url || p.image_front_url || null,
          calories,
          protein: toNum(p.nutriments?.proteins_100g),
          carbs: toNum(p.nutriments?.carbohydrates_100g),
          fat: toNum(p.nutriments?.fat_100g),
        };
      });

    // Optional: small sort boost for “English-ish” names and image presence
    foods.sort((a, b) => {
      const aScore = (a.image ? 2 : 0) + (/^[\x00-\x7F]*$/.test(a.name) ? 1 : 0);
      const bScore = (b.image ? 2 : 0) + (/^[\x00-\x7F]*$/.test(b.name) ? 1 : 0);
      return bScore - aScore;
    });

    return res.status(200).json({ foods });
  } catch (err) {
    console.error("[foods/search] error:", err);
    return res.status(500).json({ foods: [] });
  }
}
