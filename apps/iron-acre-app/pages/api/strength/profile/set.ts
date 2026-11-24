// FILE: pages/api/strength/profile/set.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions).catch(() => null);
  const email = String(session?.user?.email || "").trim().toLowerCase();
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  const b = req.body || {};
  const rounding_increment_kg =
    b.rounding_increment_kg === undefined || b.rounding_increment_kg === null
      ? undefined
      : Number(b.rounding_increment_kg);

  const training_maxes = typeof b.training_maxes === "object" && b.training_maxes ? b.training_maxes : {};

  // Normalise numbers
  const cleaned: Record<string, number> = {};
  for (const k of Object.keys(training_maxes)) {
    const v = Number(training_maxes[k]);
    if (Number.isFinite(v) && v > 0) cleaned[String(k).trim()] = v;
  }

  try {
    const ref = firestore.collection("user_strength_profiles").doc(email);
    await ref.set(
      {
        training_maxes: cleaned,
        rounding_increment_kg: Number.isFinite(rounding_increment_kg) ? rounding_increment_kg : 2.5,
        updated_at: Timestamp.now(),
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Failed to save profile" });
  }
}
