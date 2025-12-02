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
  if (!query || query.length < 2) return res.status(200).json({ foods: [] });

  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      query
    )}&search_simple=1&action=process&json=1&page_size=30`;

    const response = await fetch(url);
    if (!response.ok) return res.status(502).json({ foods: [] });

    const data = await response.json();

    const foods: Food[] = (data.products || [])
      .filter((p: any) => p.nutriments)
      .map((p: any) => {
        const calories = p.nutriments["energy-kcal_100g"] ?? p.nutriments["energy_100g"] ?? 0;
        return {
          id: p.code,
          code: p.code,
          name: p.product_name || p.generic_name || query,
          brand: p.brands || "Unknown",
          image: p.image_front_small_url || p.image_front_url || null,
          calories: Number(calories) || 0,
          protein: Number(p.nutriments.proteins_100g || 0),
          carbs: Number(p.nutriments.carbohydrates_100g || 0),
          fat: Number(p.nutriments.fat_100g || 0),
        };
      });

    res.status(200).json({ foods });
  } catch (err) {
    console.error(err);
    res.status(500).json({ foods: [] });
  }
}