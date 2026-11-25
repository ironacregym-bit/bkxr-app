import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"] as const;
function startOfAlignedWeek(d: Date) { const day = d.getDay(); const diffToMon = (day + 6) % 7; const s = new Date(d); s.setDate(d.getDate() - diffToMon); s.setHours(0,0,0,0); return s; }
function formatYMD(d: Date) { return d.toLocaleDateString("en-CA"); }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.setHeader("Allow","GET"); return res.status(405).json({ error: "Method not allowed" }); }
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email || "";
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const today = new Date();
    const weekStart = startOfAlignedWeek(today);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);

    // Find overlapping active assignment (latest created wins)
    const q = firestore
      .collection("meal_plan_assignments")
      .where("user_email", "==", email)
      .where("status", "==", "active")
      .where("start_date", "<=", weekEnd);

    const snap = await q.get();
    const overlapping = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((a) => {
        const s = a.start_date?.toDate?.() || new Date(a.start_date);
        const e = a.end_date?.toDate?.() || new Date(a.end_date);
        return !(e < weekStart || s > weekEnd);
      })
      .sort((a, b) => {
        const ac = (a.created_at?.toDate?.() || new Date(a.created_at || 0)).getTime();
        const bc = (b.created_at?.toDate?.() || new Date(b.created_at || 0)).getTime();
        return bc - ac;
      });

    const assignment = overlapping[0] || null;
    if (!assignment) return res.status(200).json({ assignment: null, week: [], plan: null });

    const planSnap = await firestore.collection("meal_plan_library").doc(String(assignment.plan_id)).get();
    const plan = planSnap.exists ? { id: planSnap.id, ...(planSnap.data() as any) } : null;

    const out: Array<{ ymd: string; day: string; items: any[] }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
      const ymd = formatYMD(d);
      const dayName = DAYS[d.getDay()];
      const itemsRef = firestore
        .collection("meal_plans")
        .doc(email)
        .collection("days")
        .doc(ymd)
        .collection("items")
        .where("source.plan_id", "==", String(assignment.plan_id));

      const itemsSnap = await itemsRef.limit(200).get();
      const items = itemsSnap.docs.map((x) => ({ id: x.id, ...(x.data() as any) }));
      out.push({ ymd, day: dayName, items });
    }

    return res.status(200).json({
      assignment: {
        id: assignment.assignment_id || String(assignment.id),
        plan_id: assignment.plan_id,
        start_date: (assignment.start_date?.toDate?.() || new Date(assignment.start_date)).toISOString(),
        end_date: (assignment.end_date?.toDate?.() || new Date(assignment.end_date)).toISOString(),
        status: assignment.status || "active",
      },
      plan,
      week: out,
    });
  } catch (e: any) {
    console.error("[mealplan/my]", e?.message || e);
    return res.status(500).json({ error: "Failed to load current plan" });
  }
}
