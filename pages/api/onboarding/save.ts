
// pages/api/onboarding/save.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  const {
    email,
    sex,
    height_cm,
    weight_kg,
    bodyfat_pct,
    DOB,
    activity_factor,
    calorie_target,
    protein_target,
    carb_target,
    fat_target,
    gym_id,
    location,
    role,
    // equipment, preferences (accepted but not stored in Users; keep for future use)
  } = req.body || {};

  const userEmail = String(email || session.user.email);

  try {
    const usersRef = firestore.collection("Users").doc(userEmail);
    const snap = await usersRef.get();
    const nowIso = new Date().toISOString();

    const payload: any = {
      email: userEmail,
      sex: sex ?? null,
      height_cm: height_cm != null ? Number(height_cm) : null,
      weight_kg: weight_kg != null ? Number(weight_kg) : null,
      bodyfat_pct: bodyfat_pct != null ? Number(bodyfat_pct) : null,
      DOB: DOB || null,
      activity_factor: activity_factor != null ? Number(activity_factor) : null,

      calorie_target: calorie_target != null ? Number(calorie_target) : null,
      protein_target: protein_target != null ? Number(protein_target) : null,
      carb_target: carb_target != null ? Number(carb_target) : null,
      fat_target: fat_target != null ? Number(fat_target) : null,

      gym_id: gym_id || null,
      location: location || null,
      role: role || null,
      last_login_at: nowIso, // harmless refresh marker
    };

    if (!snap.exists) {
      payload.created_at = nowIso;
    }

    await usersRef.set(payload, { merge: true });
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[onboarding/save] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to save onboarding" });
  }
}
