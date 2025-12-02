// pages/api/foods/search.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const query = (req.query.query as string || "").trim().toLowerCase();
    if (!query) return res.status(200).json({ foods: [] });

    const docId = query.replace(/\s+/g, "_");

    // 1. Check cache
    const doc = await firestore.collection("food_cache").doc(docId).get();
    if (doc.exists) {
      return res.status(200).json(doc.data());
    }

    // 2. Query OpenFoodFacts
    const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      query
    )}&search_simple=1&action=process&json=1&page_size=30`;

    const offRes = await fetch(offUrl);
    if (!offRes.ok) return res.status(502).json({ foods: [] });

    const data = await offRes.json();

    const foods = (data.products || [])
      .filter((p: any) => p.nutriments && (p.nutriments["energy-kcal_100g"] || p.nutriments["energy-kcal"]))
      .map((p: any) => {
        const calories = p.nutriments["energy-kcal_100g"] ?? p.nutriments["energy-kcal"];
        return {
          id: p.id ?? p.code,
          code: p.code,
          name: p.product_name || p.generic_name || query,
          brand: p.brands || null,
          image: p.image_front_small_url || p.image_front_url || null,
          calories: Number(calories) || null,
          protein: Number(p.nutriments?.proteins_100g || 0),
          carbs: Number(p.nutriments?.carbohydrates_100g || 0),
          fat: Number(p.nutriments?.fat_100g || 0),
          raw: p,
        };
      });

    // 3. Cache result
    await firestore.collection("food_cache").doc(docId).set({ foods, updated_at: Date.now() });

    return res.status(200).json({ foods });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ foods: [] });
  }
}