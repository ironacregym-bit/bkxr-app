import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

function digits(s: string) {
  return String(s || "").replace(/\D/g, "");
}

/**
 * GET /api/foods/lookup-barcode?barcode=CODE
 * Search order:
 *   1) user override: user_barcode_foods/{email}/foods/{code}
 *   2) global:        barcode_foods/{code}
 * Response: { foods: Array<Food> } matching your FoodEditor shape
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const raw = String(req.query.barcode || "");
    const code = digits(raw);
    if (!code) return res.status(400).json({ foods: [] });

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
        const d = us.data()!;
        return res.status(200).json({
          foods: [
            {
              id: code,
              code,
              name: d.name,
              brand: d.brand || "",
              image: d.image || null,
              calories: d.calories || 0,
              protein: d.protein || 0,
              carbs: d.carbs || 0,
              fat: d.fat || 0,
              servingSize: d.servingSize || "",
              caloriesPerServing: null,
              proteinPerServing: null,
              carbsPerServing: null,
              fatPerServing: null,
            },
          ],
        });
      }
    }

    // 2) global
    const gs = await firestore.collection("barcode_foods").doc(code).get();
    if (gs.exists) {
      const d = gs.data()!;
      return res.status(200).json({
        foods: [
          {
            id: code,
            code,
            name: d.name,
            brand: d.brand || "",
            image: d.image || null,
            calories: d.calories || 0,
            protein: d.protein || 0,
            carbs: d.carbs || 0,
            fat: d.fat || 0,
            servingSize: d.servingSize || "",
            caloriesPerServing: null,
            proteinPerServing: null,
            carbsPerServing: null,
            fatPerServing: null,
          },
        ],
      });
    }

    // Not found
    return res.status(200).json({ foods: [] });
  } catch (e: any) {
    console.error("[foods/lookup-barcode] error:", e?.message || e);
    return res.status(500).json({ foods: [] });
  }
}
