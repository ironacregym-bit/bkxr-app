import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions).catch(() => null);
  const role = (session?.user as any)?.role;

  if (!session || !["admin", "gym"].includes(role)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const snap = await firestore
      .collection("workouts")
      .where("workout_type", "==", "gym_custom")
      .orderBy("created_at", "desc")
      .get();

    const workouts = snap.docs.map((d) => ({
      workout_id: d.id,
      workout_name: d.get("workout_name"),
    }));

    return res.status(200).json({ workouts });
  } catch (e: any) {
    console.error("[workouts/admin/list] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to load workouts" });
  }
}
``
