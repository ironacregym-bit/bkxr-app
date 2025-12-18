
// pages/api/foods/search.ts
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const query = (req.query.query as string || "").trim();
  const barcode = (req.query.barcode as string || "").trim();

  try {
    // Barcode lookup takes precedence when provided
    if (barcode && barcode.length >= 6) {
      const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`;
      const response = await fetch(url);
      if (!response.ok) return res.status(502).json({ foods: [] });
      const data = await response.json();

      if (!data || data.status !== 1 || !data.product || !data.product.nutriments) {
        // No product found for this barcode
        return res.status(200).json({ foods: [] });
      }

      const p = data.product;
      const calories =
        p.nutriments?.["energy-kcal_100g"] ??
        p.nutriments?.["energy_100g"] ??
        0;

      const food: Food = {
        id: p.code,
        code: p.code,
        name: p.product_name || p.generic_name || "Unknown",
        brand: p.brands || "Unknown",
        image: p.image_front_small_url || p.image_front_url || null,
        calories: Number(calories) || 0,
        protein: Number(p.nutriments?.proteins_100g || 0),
        carbs: Number(p.nutriments?.carbohydrates_100g || 0),
        fat: Number(p.nutriments?.fat_100g || 0),
      };

      return res.status(200).json({ foods: [food] });
    }

    // Text search fallback
    if (!query || query.length < 2) return res.status(200).json({ foods: [] });

    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      query
    )}&search_simple=1&action=process&json=1&page_size=30`;

    const response = await fetch(url);
    if (!response.ok) return res.status(502).json({ foods: [] });

    const data = await response.json();

    const foods: Food[] = (data.products || [])
      .filter((p: any) => p.nutriments)
      .map((p: any) => {
        const calories =
          p.nutriments?.["energy-kcal_100g"] ??
          p.nutriments?.["energy_100g"] ??
          0;
        return {
          id: p.code,
          code: p.code,
          name: p.product_name || p.generic_name || query,
          brand: p.brands || "Unknown",
          image: p.image_front_small_url || p.image_front_url || null,
          calories: Number(calories) || 0,
          protein: Number(p.nutriments?.proteins_100g || 0),
          carbs: Number(p.nutriments?.carbohydrates_100g || 0),
          fat: Number(p.nutriments?.fat_100g || 0),
        };
      });

    res.status(200).json({ foods });
  } catch (err) {
    console.error(err);
    res.status(500).json({ foods: [] })
  }
