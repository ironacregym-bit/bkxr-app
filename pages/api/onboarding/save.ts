
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

  try {
    const {
      email,
      height_cm,
      weight_kg,
      DOB,
      sex,
      activity_factor,
      job_type,
      goal_primary,
      goal_intensity,
      equipment,
      preferences,
    } = req.body || {};

    const userEmail = String(email || session.user.email);

    // Write to Users (sheet-style) collection by email id
    const usersRef = firestore.collection("Users").doc(userEmail);
    const now = new Date();

    await usersRef.set(
      {
        email: userEmail,
        height_cm: height_cm != null ? Number(height_cm) : null,
        weight_kg: weight_kg != null ? Number(weight_kg) : null,
        DOB: DOB || null,
        sex: sex || null,
        activity_factor: activity_factor != null ? Number(activity_factor) : null,
        job_type: job_type || null,
        goal_primary: goal_primary || null,
        goal_intensity: goal_intensity || null,
        equipment: equipment || null,
        preferences: preferences || null,
        updated_at: now.toISOString(),
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[onboarding/save] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to save onboarding" });
  }
}
