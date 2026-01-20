
// pages/api/recipes/upsert.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow","POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const session = await getServerSession(req, res, authOptions);
  const role = (session?.user as any)?.role || "user";
  if (!session?.user?.email || (role !== "admin" && role !== "gym")) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { recipe } = req.body || {};
    if (!recipe?.title || !recipe?.meal_type) return res.status(400).json({ error: "title & meal_type required" });
    if (Array.isArray(recipe.ingredients) && recipe.ingredients.length > 6) return res.status(400).json({ error: "Max 6 ingredients" });

    const doc = firestore.collection("recipes").doc();
    await doc.set({
      title: String(recipe.title),
      meal_type: String(recipe.meal_type).toLowerCase(),
      image: recipe.image || null,
      servings: Number(recipe.servings || 1),
      per_serving: recipe.per_serving || {},
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
      created_at: new Date().toISOString(),
      created_by: session.user.email,
    }, { merge: true });

    return res.status(200).json({ ok: true, id: doc.id });
  } catch (e: any) {
    console.error("[recipes/upsert]", e?.message || e);
    return res.status(500).json({ error: "Failed to save recipe" });
  }
}
