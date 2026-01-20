
// pages/api/shopping/generate.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

function isYMD(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  const { date } = (req.body || {}) as { date?: string };
  if (!date || !isYMD(date)) return res.status(400).json({ error: "date (YYYY-MM-DD) required" });

  try {
    // Read today’s plan items
    const dayRef = firestore.collection("meal_plans").doc(email).collection("days").doc(date);
    const itemsSnap = await dayRef.collection("items").get();
    const planItems = itemsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    // Aggregate ingredients by (name, unit)
    const aggregate = new Map<string, { name: string; qty: number; unit: string|null }>();

    for (const it of planItems) {
      const recipeId = it.recipe_id;
      const multiplier = Number(it.multiplier || 1);
      if (!recipeId || multiplier <= 0) continue;

      const recipeSnap = await firestore.collection("recipes").doc(recipeId).get();
      if (!recipeSnap.exists) continue;
      const recipe: any = recipeSnap.data() || {};
      const ings: any[] = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
      for (const ing of ings) {
        const name = String(ing.name || "").trim();
        if (!name) continue;
        const baseQty = Number(ing.qty || 0);
        const unit = ing.unit ? String(ing.unit) : null;
        const qty = Number((baseQty * multiplier).toFixed(2));

        const key = `${name}__${unit || "null"}`;
        const prev = aggregate.get(key);
        if (prev) {
          prev.qty = Number((prev.qty + qty).toFixed(2));
        } else {
          aggregate.set(key, { name, qty, unit });
        }
      }
    }

    // Write new items (dedupe by name+unit, append; do not remove existing)
    const listColl = firestore.collection("shopping_lists").doc(email).collection("items");
    let added = 0;
    for (const { name, qty, unit } of Array.from(aggregate.values())) {
      // Simple append; if you want smarter dedupe against existing names, read list and merge
      const docRef = listColl.doc();
      await docRef.set({
        name,
        qty,
        unit,
        done: false,
        added_at: new Date().toISOString(),
        source: { type: "meal_plan", date },
      }, { merge: true });
      added++;
    }

    return res.status(200).json({ ok: true, added });
  } catch (e: any) {
    console.error("[shopping/generate]", e?.message || e);
    return res.status(500).json({ error: "Failed to generate shopping list" });
  }
}
