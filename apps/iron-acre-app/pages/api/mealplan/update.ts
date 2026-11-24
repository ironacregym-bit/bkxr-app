
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

function isYMD(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
type Macros = { calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number; [k: string]: any };
function scaleMacros(per: Macros, mul: number): Macros {
  const out: any = {};
  for (const [k, v] of Object.entries(per || {})) {
    out[k] = typeof v === "number" ? Number((v * mul).toFixed(2)) : v;
  }
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow","POST"); return res.status(405).json({ error: "Method not allowed" }); }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { date, itemId, multiplier } = (req.body || {}) as { date: string; itemId: string; multiplier: number };
    if (!isYMD(date)) return res.status(400).json({ error: "date (YYYY-MM-DD) required" });
    if (!itemId) return res.status(400).json({ error: "itemId required" });
    const m = Number(multiplier);
    if (!isFinite(m) || m <= 0) return res.status(400).json({ error: "multiplier must be > 0" });

    const itemRef = firestore.collection("meal_plans").doc(email).collection("days").doc(date).collection("items").doc(itemId);
    const snap = await itemRef.get();
    if (!snap.exists) return res.status(404).json({ error: "Item not found" });

    const item = snap.data() as any;
    const per = item.per_serving || {};
    const scaled = scaleMacros(per, m);
    await itemRef.set({ multiplier: m, scaled }, { merge: true });

    return res.status(200).json({ ok: true, item: { id: itemId, ...item, multiplier: m, scaled } });
  } catch (e: any) {
    console.error("[mealplan/update]", e?.message || e);
    return res.status(500).json({ error: "Failed to update portion" });
  }
}
