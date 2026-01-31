import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"] as const;
type DayName = typeof DAYS[number];
type MealType = "breakfast"|"lunch"|"dinner"|"snack";

type PlanItem = {
  day: DayName;
  meal_type: MealType;
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

function isDayName(s: string): s is DayName {
  return (DAYS as readonly string[]).includes(s);
}
function isMealType(s: string): s is MealType {
  return ["breakfast","lunch","dinner","snack"].includes(s);
}

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

    const items: PlanItem[] = Array.isArray(plan.items) ? plan.items : [];
    for (const [idx, it] of items.entries()) {
      if (!it?.recipe_id) return res.status(400).json({ error: `items[${idx}].recipe_id required` });
      if (!isDayName(String(it.day))) return res.status(400).json({ error: `items[${idx}].day invalid` });
      if (!isMealType(String(it.meal_type))) return res.status(400).json({ error: `items[${idx}].meal_type invalid` });
      if (it.default_multiplier != null && (!Number.isFinite(Number(it.default_multiplier)) || Number(it.default_multiplier) <= 0)) {
        return res.status(400).json({ error: `items[${idx}].default_multiplier must be > 0` });
      }
    }

    const clean: Plan = {
      id: plan.id || undefined,
      title: String(plan.title).trim(),
      tier: tier === "premium" ? "premium" : "free",
      description: plan.description ? String(plan.description) : null,
      image: plan.image ? String(plan.image) : null,
      items: items.map((x) => ({
        day: x.day,
        meal_type: x.meal_type,
        recipe_id: String(x.recipe_id),
        default_multiplier: x.default_multiplier != null ? Number(x.default_multiplier) : undefined,
      })),
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
    console.error("[mealplan/library/upsert]", e?.message || e);
    return res.status(500).json({ error: "Failed to save meal plan" });
  }
}
