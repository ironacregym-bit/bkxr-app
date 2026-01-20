
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

function isYMD(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow","POST"); return res.status(405).json({ error: "Method not allowed" }); }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const { date, itemId } = (req.body || {}) as { date: string; itemId: string };
    if (!isYMD(date)) return res.status(400).json({ error: "date (YYYY-MM-DD) required" });
    if (!itemId) return res.status(400).json({ error: "itemId required" });

    const ref = firestore.collection("meal_plans").doc(email).collection("days").doc(date).collection("items").doc(itemId);
    await ref.delete();

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("[mealplan/remove]", e?.message || e);
    return res.status(500).json({ error: "Failed to remove item" });
  }
}
