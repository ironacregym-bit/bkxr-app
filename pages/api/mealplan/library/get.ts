import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

/**
 * meal_plan_library/{planId}:
 * {
 *   title: string,
 *   tier: "free"|"premium",
 *   description?: string,
 *   image?: string,
 *   items: Array<{ day: "Monday"|"Tuesday"|..., meal_type: "breakfast"|"lunch"|"dinner"|"snack", recipe_id: string, default_multiplier?: number }>
 * }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  const planId = String(req.query.plan_id || req.query.id || "").trim();
  if (!planId) return res.status(400).json({ error: "plan_id required" });

  try {
    const ref = firestore.collection("meal_plan_library").doc(planId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Plan not found" });
    return res.status(200).json({ id: snap.id, ...(snap.data() as any) });
  } catch (e: any) {
    console.error("[mealplan/library/get]", e?.message || e);
    return res.status(500).json({ error: "Failed to load plan" });
  }
}
