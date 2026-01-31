import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

function isYMD(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
const parseYMD = (s: string) => { const [y,m,dd]=s.split("-").map(Number); return new Date(y, m-1, dd, 12,0,0,0); };
function formatYMD(d: Date) { return d.toLocaleDateString("en-CA"); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow","POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email || "";
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { plan_id, start_date, end_date, list_id } = (req.body || {}) as {
      plan_id?: string;
      start_date: string;
      end_date: string;
      list_id?: string;
    };

    if (!isYMD(start_date) || !isYMD(end_date)) {
      return res.status(400).json({ error: "start_date and end_date must be YYYY-MM-DD" });
    }
    const start = parseYMD(start_date);
    const end = parseYMD(end_date);
    if (start > end) return res.status(400).json({ error: "start_date must be on/before end_date" });

    // Discover plan_id from active assignment if not provided
    let planId = String(plan_id || "").trim();
    if (!planId) {
      const q = firestore
        .collection("meal_plan_assignments")
        .where("user_email", "==", email)
        .where("status", "==", "active")
        .where("start_date", "<=", end);
      const snap = await q.get();
      const overlapping = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((a) => {
          const s = a.start_date?.toDate?.() || new Date(a.start_date);
          const e = a.end_date?.toDate?.() || new Date(a.end_date);
          return !(e < start || s > end);
        })
        .sort((a, b) => {
          const ac = (a.created_at?.toDate?.() || new Date(a.created_at || 0)).getTime();
          const bc = (b.created_at?.toDate?.() || new Date(b.created_at || 0)).getTime();
          return bc - ac;
        });
      if (!overlapping.length) return res.status(400).json({ error: "No active plan found for date range" });
      planId = String(overlapping[0].plan_id);
    }

    // Load plan to know which recipes to include per day-name
    const planSnap = await firestore.collection("meal_plan_library").doc(planId).get();
    if (!planSnap.exists) return res.status(404).json({ error: "Plan not found" });
    const plan = planSnap.data() as any;
    const items: Array<{ day: string; recipe_id: string; default_multiplier?: number }> = Array.isArray(plan.items) ? plan.items : [];

    // Build date → recipes for the range
    const recipesToAdd: Array<{ recipe_id: string; people: number }> = [];
    const daysCount = Math.round((end.getTime() - start.getTime()) / (24*3600*1000)) + 1;
    for (let i = 0; i < daysCount; i++) {
      const d = addDays(start, i);
      const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()];
      const todays = items.filter((it) => it.day === dayName);
      for (const t of todays) {
        const people = 1; // keep per-serving for user; scale later if you add per-user household size
        recipesToAdd.push({ recipe_id: t.recipe_id, people });
      }
    }

    if (!recipesToAdd.length) return res.status(200).json({ ok: true, added: 0, updated: 0 });

    // Call your shopping list API path via server-internal call:
    // Reuse the merge logic by sending items array
    const resp = await fetch(`${(process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""))}/api/shopping/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Action "addRecipes" expects 'items' array: [{ recipe_id, people }]
      body: JSON.stringify({ action: "addRecipes", items: recipesToAdd, list_id }),
    });
    const json = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({ error: json?.error || "Shopping list generation failed" });
    }

    return res.status(200).json({ ok: true, ...json });
  } catch (e: any) {
    console.error("[mealplans/shopping-from-plan]", e?.message || e);
    return res.status(500).json({ error: "Failed to generate shopping list" });
  }
}
