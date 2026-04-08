// FILE: pages/api/strength/profile/get.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions).catch(() => null);
  const email = String(session?.user?.email || "").trim().toLowerCase();
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const ref = firestore.collection("user_strength_profiles").doc(email);
    const snap = await ref.get();
    const data = snap.exists ? snap.data() : null;

    return res.status(200).json({
      ok: true,
      email,
      profile: data || { training_maxes: {}, rounding_increment_kg: 2.5 },
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Failed to load profile" });
  }
}
