// pages/api/foods/search.ts
import { NextRequest, NextResponse } from "next/server";
import firestore from "@/lib/firestoreClient";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = (url.searchParams.get("query") || "").trim().toLowerCase();
    if (!query) return NextResponse.json({ foods: [] });

    const docId = query.replace(/\s+/g, "_");

    // 1. Check cache
    const doc = await firestore.collection("food_cache").doc(docId).get();
    if (doc.exists) {
      const cached = doc.data();
      return NextResponse.json(cached);
    }

    // 2. Query OpenFoodFacts
    const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      query
    )}&search_simple=1&action=process&json=1&page_size=30`;

    const res = await fetch(offUrl);
    if (!res.ok) {
      return NextResponse.json({ foods: [] }, { status: 502 });
    }

    const data = await res.json();

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

    // 3. Cache result (save a small subset)
    await firestore.collection("food_cache").doc(docId).set({ foods, updated_at: Date.now() });

    return NextResponse.json({ foods });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ foods: [] }, { status: 500 });
  }
}