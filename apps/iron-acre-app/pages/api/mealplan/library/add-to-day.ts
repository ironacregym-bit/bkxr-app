import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

function isYMD(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow","POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email || "";
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { plan_id, date, selection } = (req.body || {}) as {
      plan_id: string;
      date: string;                       // YYYY-MM-DD
      selection?: Array<{ recipe_id: string; multiplier?: number }>; // optional filter subset
    };
    if (!plan_id) return res.status(400).json({ error: "plan_id required" });
    if (!isYMD(date)) return res.status(400).json({ error: "date must be YYYY-MM-DD" });

    // Load plan
    const planSnap = await firestore.collection("meal_plan_library").doc(plan_id).get();
    if (!planSnap.exists) return res.status(404).json({ error: "Plan not found" });
    const plan = planSnap.data() as any;

    const itemsIn: Array<{ meal_type?: string; recipe_id: string; default_multiplier?: number }> =
      Array.isArray(plan.items) ? plan.items : [];
    if (!itemsIn.length) return res.status(400).json({ error: "Plan has no items" });

    // Filter if selection provided
    const selectedSet = new Set((selection || []).map((x) => String(x.recipe_id)));
    const items = selection && selection.length
      ? itemsIn.filter((it) => selectedSet.has(String(it.recipe_id)))
      : itemsIn;

    // Map recipe_id -> override multiplier if provided
    const overrideMult = new Map<string, number>();
    (selection || []).forEach((s) => {
      const m = Number(s.multiplier);
      if (Number.isFinite(m) && m > 0) overrideMult.set(String(s.recipe_id), m);
    });

    // Prepare batch writes into user's day
    const dayRef = firestore.collection("meal_plans").doc(email).collection("days").doc(date);
    const batch = firestore.batch();
    const nowIso = new Date().toISOString();

    // Cache recipes to reduce reads
    const recipeCache = new Map<string, any>();
    async function getRecipe(recipeId: string) {
      if (recipeCache.has(recipeId)) return recipeCache.get(recipeId);
      const r = await firestore.collection("recipes").doc(recipeId).get();
      const data = r.exists ? (r.data() as any) : null;
      recipeCache.set(recipeId, data);
      return data;
    }

    function scaleMacros(per: any, mul: number) {
      const out: any = {};
      for (const [k, v] of Object.entries(per || {})) {
        out[k] = typeof v === "number" ? Number((v * mul).toFixed(2)) : v;
      }
      return out;
    }

    for (const row of items) {
      const rec = await getRecipe(row.recipe_id);
      if (!rec) continue;
      const per = rec.per_serving || {};
      const def = Number(row.default_multiplier || 1);
      const m = overrideMult.get(String(row.recipe_id)) ?? def;
      const scaled = scaleMacros(per, m);

      const payload = {
        recipe_id: row.recipe_id,
        title: rec.title || "Recipe",
        meal_type: row.meal_type || null,
        image: rec.image || null,
        multiplier: m,
        per_serving: per,
        scaled,
        added_at: nowIso,
        source: { type: "plan-library", plan_id },
      };
      const ref = dayRef.collection("items").doc();
      batch.set(ref, payload, { merge: true });
    }

    await batch.commit();
    return res.status(201).json({ ok: true });
  } catch (e: any) {
    console.error("[mealplan/library/add-to-day]", e?.message || e);
    return res.status(500).json({ error: "Failed to add plan items to day" });
  }
}
