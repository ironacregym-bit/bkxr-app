
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

function isYMD(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow","GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  const date = String(req.query.date || "").trim();
  if (!isYMD(date)) return res.status(400).json({ error: "date required as YYYY-MM-DD" });

  try {
    const dayRef = firestore.collection("meal_plans").doc(email).collection("days").doc(date);
    const itemsSnap = await dayRef.collection("items").orderBy("added_at", "asc").get();
    const items = itemsSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));

    // Compute totals from items if not stored
    const totals = items.reduce((acc, it) => {
      const s = it.scaled || {};
      acc.calories += Number(s.calories || 0);
      acc.protein_g += Number(s.protein_g || 0);
      acc.carbs_g += Number(s.carbs_g || 0);
      acc.fat_g += Number(s.fat_g || 0);
      return acc;
    }, { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

    // Targets from user profile
    const userSnap = await firestore.collection("users").doc(email).get();
    const profile = userSnap.exists ? (userSnap.data() as any) : {};
    const caloricTarget = Number(profile.caloric_target || 0) || null;

    // Default macro split (P/C/F): 30/40/30; override if you later add user preferences
    const macroSplit = profile.macro_split || { protein_pct: 30, carbs_pct: 40, fat_pct: 30 };
    const targets = caloricTarget ? {
      calories: caloricTarget,
      protein_g: Math.round((macroSplit.protein_pct / 100) * caloricTarget / 4),
      carbs_g: Math.round((macroSplit.carbs_pct / 100) * caloricTarget / 4),
      fat_g: Math.round((macroSplit.fat_pct / 100) * caloricTarget / 9),
    } : null;

    return res.status(200).json({ items, totals, targets });
  } catch (e: any) {
    console.error("[mealplan/get]", e?.message || e);
    return res.status(500).json({ error: "Failed to read meal plan" });
  }
}
