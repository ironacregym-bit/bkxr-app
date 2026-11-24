import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

const isMeal = (s: any) =>
  ["breakfast","lunch","dinner","snack"].includes(String(s || "").toLowerCase());

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const session = await getServerSession(req, res, authOptions);
  const role = (session?.user as any)?.role || "user";
  if (!session?.user?.email || (role !== "admin" && role !== "gym"))
    return res.status(401).json({ error: "Unauthorized" });

  try {
    const { plans } = req.body || {};
    const arr = Array.isArray(plans) ? plans : plans && typeof plans === "object" ? [plans] : [];
    if (!arr.length) return res.status(400).json({ error: "plans must be array or object" });

    const col = firestore.collection("meal_plan_library");
    const nowIso = new Date().toISOString();

    let inserted = 0;
    for (const p of arr) {
      const title = String(p?.title || "").trim();
      if (!title) continue;
      const tier = String(p?.tier || "free").toLowerCase();
      if (!["free","premium"].includes(tier)) continue;

      const itemsIn = Array.isArray(p?.items) ? p.items : [];
      if (!itemsIn.length) continue;
      const cleanItems = itemsIn
        .filter((it: any) => it?.recipe_id)
        .map((it: any) => {
          const out: any = { recipe_id: String(it.recipe_id) };
          if (it.meal_type && isMeal(it.meal_type)) out.meal_type = String(it.meal_type).toLowerCase();
          if (it.default_multiplier != null) out.default_multiplier = Number(it.default_multiplier) || 1;
          return out;
        });

      const ref = col.doc();
      await ref.set({
        title,
        tier,
        description: p?.description ? String(p.description) : null,
        image: p?.image ? String(p.image) : null,
        items: cleanItems,
        created_at: nowIso,
        created_by: session?.user?.email || null,
        updated_at: nowIso,
        updated_by: session?.user?.email || null,
      });
      inserted++;
    }

    return res.status(200).json({ ok: true, inserted });
  } catch (e: any) {
    console.error("[mealplan/library/bulk]", e?.message || e);
    return res.status(500).json({ error: "Bulk import failed" });
  }
}
