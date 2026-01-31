import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

function isYMD(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
const parseYMD = (s: string) => { const [y,m,dd]=s.split("-").map(Number); return new Date(y, m-1, dd, 12,0,0,0); };
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow","POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email || "";
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { plan_id, start_date, end_date, people, list_id } = (req.body || {}) as {
      plan_id?: string;
      start_date: string;
      end_date: string;
      people?: number;  // household size
      list_id?: string; // optional shopping list to target
    };

    if (!isYMD(start_date) || !isYMD(end_date)) {
      return res.status(400).json({ error: "start_date and end_date must be YYYY-MM-DD" });
    }
    const start = parseYMD(start_date);
    const end = parseYMD(end_date);
    if (start > end) return res.status(400).json({ error: "start_date must be on/before end_date" });
    const ppl = Math.max(1, Number(people || 1));

    // Determine active plan if plan_id not provided
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

    // Load plan
    const planSnap = await firestore.collection("meal_plan_library").doc(planId).get();
    if (!planSnap.exists) return res.status(404).json({ error: "Plan not found" });
    const plan = planSnap.data() as any;
    const items: Array<{ day: string; recipe_id: string }> = Array.isArray(plan.items) ? plan.items : [];

    // Build date → recipes list for range
    const daysCount = Math.round((end.getTime() - start.getTime()) / (24*3600*1000)) + 1;
    const recipesToAdd: Array<{ recipe_id: string; people: number }> = [];
    for (let i = 0; i < daysCount; i++) {
      const d = addDays(start, i);
      const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()];
      const todays = items.filter((it) => it.day === dayName);
      for (const t of todays) {
        recipesToAdd.push({ recipe_id: t.recipe_id, people: ppl });
      }
    }

    if (!recipesToAdd.length) return res.status(200).json({ ok: true, added: 0, updated: 0 });

    // Reuse shopping list merge (server-side internal call)
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const resp = await fetch(`${baseUrl}/api/shopping/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addRecipes", items: recipesToAdd, list_id }),
    });
    const json = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({ error: json?.error || "Shopping list generation failed" });
    }

    return res.status(200).json({ ok: true, ...json });
  } catch (e: any) {
    console.error("[mealplan/shopping-from-plan]", e?.message || e);
    return res.status(500).json({ error: "Failed to generate shopping list" });
  }
}
