
// pages/api/recipes/bulk.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const role = (session?.user as any)?.role || "user";
  if (!session?.user?.email || (role !== "admin" && role !== "gym")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ✅ After the guard, cache a non-nullable createdBy for TS
  const createdBy: string = session.user.email;

  try {
    const { recipes } = (req.body || {}) as { recipes?: any[] };
    if (!Array.isArray(recipes)) {
      return res.status(400).json({ error: "recipes must be an array" });
    }

    const batch = firestore.batch();
    let inserted = 0;

    for (const r of recipes) {
      if (!r?.title || !r?.meal_type) continue;
      if (Array.isArray(r.ingredients) && r.ingredients.length > 6) continue;

      const docRef = firestore.collection("recipes").doc();
      batch.set(
        docRef,
        {
          title: String(r.title),
          meal_type: String(r.meal_type).toLowerCase(),
          image: r.image || null,
          servings: Number(r.servings || 1),
          per_serving: r.per_serving || {},
          ingredients: r.ingredients || [],
          instructions: r.instructions || [],
          created_at: new Date().toISOString(),
          created_by: createdBy, // ✅ guaranteed string
        },
        { merge: true }
      );
      inserted++;
    }

    await batch.commit();
    return res.status(200).json({ ok: true, inserted });
  } catch (e: any) {
    console.error("[recipes/bulk]", e?.message || e);
    return res.status(500).json({ error: "Bulk import failed" });
  }
}
