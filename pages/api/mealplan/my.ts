import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"] as const;
type DayName = typeof DAYS[number];

function isYMD(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
const toISO = (d = new Date()) => d.toISOString();
const parseYMD = (s: string): Date => {
  const [y, m, dd] = s.split("-").map(Number);
  return new Date(y, m - 1, dd, 12, 0, 0, 0); // 12:00 to avoid TZ drift
};
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function formatYMD(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

type AssignBody = {
  plan_id: string;
  start_date: string; // YYYY-MM-DD (Monday recommended but not required)
  weeks: number;      // 1..12
  people?: number;    // used when generating shopping lists later; items multiplier remains per-serving by default
  overwrite?: boolean;// clear existing items for this plan within range
};

type PlanItem = {
  day: DayName;
  meal_type: "breakfast"|"lunch"|"dinner"|"snack";
  recipe_id: string;
  default_multiplier?: number;
};

type RecipeDoc = {
  title?: string;
  image?: string | null;
  per_serving?: { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number };
};

function scaleMacros(per: any, mul: number) {
  const out: any = {};
  for (const [k, v] of Object.entries(per || {})) {
    out[k] = typeof v === "number" ? Number((v * mul).toFixed(2)) : v;
  }
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow","POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email || "";
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const body = (req.body || {}) as AssignBody;
    const { plan_id, start_date, weeks, overwrite } = body;
    if (!plan_id) return res.status(400).json({ error: "plan_id required" });
    if (!isYMD(start_date)) return res.status(400).json({ error: "start_date must be YYYY-MM-DD" });
    const nWeeks = Math.min(Math.max(Number(weeks || 1), 1), 12);

    // Load plan
    const planRef = firestore.collection("meal_plan_library").doc(plan_id);
    const planSnap = await planRef.get();
    if (!planSnap.exists) return res.status(404).json({ error: "Plan not found" });
    const plan = planSnap.data() as any;
    const tier = String(plan.tier || "free").toLowerCase();

    // Premium gate
    const userSnap = await firestore.collection("users").doc(email).get();
    const user = userSnap.exists ? (userSnap.data() as any) : {};
    const subscription = String(user.subscription_status || "").toLowerCase(); // "active"|"trialing"|...
    const isPremium = subscription === "active" || subscription === "trialing";
    if (tier === "premium" && !isPremium) {
      return res.status(402).json({ error: "Premium plan requires an active subscription" });
    }

    const items: PlanItem[] = Array.isArray(plan.items) ? plan.items : [];
    if (!items.length) return res.status(400).json({ error: "Plan has no items" });

    // Date range
    const start = parseYMD(start_date);
    const end = addDays(start, nWeeks * 7 - 1);

    // Create assignment record
    const assignRef = firestore.collection("meal_plan_assignments").doc();
    const assignment = {
      assignment_id: assignRef.id,
      user_email: email,
      plan_id,
      start_date: start,
      end_date: end,
      status: "active" as const,
      created_at: new Date(),
      created_by: (session.user as any)?.email || null,
    };

    // Build per-day lists from plan
    const daysCount = Math.round((end.getTime() - start.getTime()) / (24*3600*1000)) + 1;
    const perDay: Record<string, PlanItem[]> = {};
    for (let i = 0; i < daysCount; i++) {
      const day = addDays(start, i);
      const ymd = formatYMD(day);
      const name = DAYS[day.getDay()];
      const todays = items.filter((it) => it.day === name);
      if (todays.length) perDay[ymd] = todays;
    }

    // Optional overwrite: remove older plan-injected items for this plan within range
    const batch = firestore.batch();
    if (overwrite) {
      const ymds = Object.keys(perDay);
      for (const ymd of ymds) {
        const itemsColl = firestore.collection("meal_plans").doc(email).collection("days").doc(ymd).collection("items");
        // Query items that were created from this plan (we write 'source.plan_id' field when materialising)
        const oldSnap = await itemsColl.where("source.plan_id", "==", plan_id).limit(500).get();
        oldSnap.forEach((doc) => batch.delete(doc.ref));
      }
    }

    // Cache recipes to reduce reads
    const recipeCache = new Map<string, RecipeDoc>();
    async function getRecipe(recipeId: string): Promise<RecipeDoc | null> {
      if (recipeCache.has(recipeId)) return recipeCache.get(recipeId)!;
      const r = await firestore.collection("recipes").doc(recipeId).get();
      if (!r.exists) { recipeCache.set(recipeId, null as any); return null; }
      const data = (r.data() || {}) as RecipeDoc;
      recipeCache.set(recipeId, data);
      return data;
    }

    // Materialise items
    const nowIso = toISO();
    for (const [ymd, rows] of Object.entries(perDay)) {
      const dayRef = firestore.collection("meal_plans").doc(email).collection("days").doc(ymd);
      for (const row of rows) {
        const rec = await getRecipe(row.recipe_id);
        if (!rec) continue;
        const multiplier = Number(row.default_multiplier || 1);
        const per = rec.per_serving || {};
        const scaled = scaleMacros(per, multiplier);
        const payload = {
          recipe_id: row.recipe_id,
          title: rec.title || "Recipe",
          meal_type: row.meal_type,
          image: rec.image || null,
          multiplier,
          per_serving: per,
          scaled,
          added_at: nowIso,
          source: { type: "plan", plan_id, assignment_id: assignRef.id },
        };
        const newRef = dayRef.collection("items").doc();
        batch.set(newRef, payload, { merge: true });
      }
    }

    // Commit assignment + items
    batch.set(assignRef, assignment, { merge: true });
    await batch.commit();

    return res.status(201).json({
      ok: true,
      assignment_id: assignRef.id,
      plan_id,
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      weeks: nWeeks,
    });
  } catch (e: any) {
    console.error("[mealplans/assign]", e?.message || e);
    return res.status(500).json({ error: "Failed to assign meal plan" });
  }
}
