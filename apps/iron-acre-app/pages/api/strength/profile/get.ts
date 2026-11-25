import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";

type LiftSummary = {
  exercise_name?: string;
  training_max_kg?: number | null;
  best_true_1rm_kg?: number | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions).catch(() => null);
  const email = String(session?.user?.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const profileRef = firestore.collection("strength_profiles").doc(email);
    const profileSnap = await profileRef.get();

    // If user has never logged a tracked lift
    if (!profileSnap.exists) {
      return res.status(200).json({
        ok: true,
        email,
        profile: {
          training_maxes: {},
          true_1rms: {},
          rounding_increment_kg: 2.5,
        },
      });
    }

    const liftsSnap = await profileRef.collection("lifts").get();

    const training_maxes: Record<string, number> = {};
    const true_1rms: Record<string, number> = {};

    liftsSnap.forEach((doc) => {
      const d = doc.data() as LiftSummary;
      if (!d?.exercise_name) return;

      if (typeof d.training_max_kg === "number") {
        training_maxes[d.exercise_name] = d.training_max_kg;
      }

      if (typeof d.best_true_1rm_kg === "number") {
        true_1rms[d.exercise_name] = d.best_true_1rm_kg;
      }
    });

    return res.status(200).json({
      ok: true,
      email,
      profile: {
        training_maxes,
        true_1rms,
        rounding_increment_kg: 2.5,
        updated_at: profileSnap.get("updated_at") || null,
      },
    });
  } catch (e: any) {
    console.error("[strength/profile/get] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to load strength profile" });
  }
}
