import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

type MealType = "breakfast"|"lunch"|"dinner"|"snack";

type PlanItem = {
  meal_type?: MealType;           // optional
  recipe_id: string;
  default_multiplier?: number;
};

type Plan = {
  id?: string;
  title: string;
  tier: "free" | "premium";
  description?: string | null;
  image?: string | null;
  items: PlanItem[];
};

const isMeal = (s: string) =>
  ["breakfast","lunch","dinner","snack"].includes(String(s || "").toLowerCase());

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

  try {
    const { plan } = req.body || {};
    if (!plan?.title) return res.status(400).json({ error: "title required" });
    const tier = String(plan.tier || "free").toLowerCase();
    if (!["free","premium"].includes(tier)) return res.status(400).json({ error: "tier must be 'free' or 'premium'" });

    const itemsIn: any[] = Array.isArray(plan.items) ? plan.items : [];
    if (!itemsIn.length) return res.status(400).json({ error: "items must include at least one meal" });

    // Validate items (no day)
    const items: PlanItem[] = itemsIn.map((it, idx) => {
      if (!it?.recipe_id) throw new Error(`items[${idx}].recipe_id required`);
      const out: PlanItem = {
        recipe_id: String(it.recipe_id),
      };
      if (it.meal_type) {
        const mt = String(it.meal_type).toLowerCase();
        if (!isMeal(mt)) throw new Error(`items[${idx}].meal_type invalid`);
        out.meal_type = mt as MealType;
      }
      if (it.default_multiplier != null) {
        const m = Number(it.default_multiplier);
        if (!Number.isFinite(m) || m <= 0) throw new Error(`items[${idx}].default_multiplier must be > 0`);
        out.default_multiplier = m;
      }
      return out;
    });

    const clean: Plan = {
      id: plan.id || undefined,
      title: String(plan.title).trim(),
      tier: tier === "premium" ? "premium" : "free",
      description: plan.description ? String(plan.description) : null,
      image: plan.image ? String(plan.image) : null,
      items,
    };

    const col = firestore.collection("meal_plan_library");
    const nowIso = new Date().toISOString();

    if (clean.id) {
      const ref = col.doc(clean.id);
      await ref.set(
        {
          title: clean.title,
          tier: clean.tier,
          description: clean.description ?? null,
          image: clean.image ?? null,
          items: clean.items,
          updated_at: nowIso,
          updated_by: session?.user?.email || null,
        },
        { merge: true }
      );
      return res.status(200).json({ ok: true, id: clean.id, updated: true });
    } else {
      const ref = col.doc();
      await ref.set({
        title: clean.title,
        tier: clean.tier,
        description: clean.description ?? null,
        image: clean.image ?? null,
        items: clean.items,
        created_at: nowIso,
        created_by: session?.user?.email || null,
        updated_at: nowIso,
        updated_by: session?.user?.email || null,
      });
      return res.status(201).json({ ok: true, id: ref.id, created: true });
    }
  } catch (e: any) {
    const msg = e?.message || e;
    console.error("[mealplan/library/upsert]", msg);
    return res.status(500).json({ error: String(msg).startsWith("items[") ? msg : "Failed to save meal plan" });
  }
}
