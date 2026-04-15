import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";

type StrengthExerciseRow = {
  id: string;
  exercise_name: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions).catch(() => null);
  const role = (session?.user as any)?.role || "user";
  if (!session || (role !== "admin" && role !== "gym")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const snap = await firestore
      .collection("strength_exercises")
      .where("tracked", "==", true)
      .get();

    const items: StrengthExerciseRow[] = snap.docs
      .map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          exercise_name: String(data?.exercise_name || "").trim(),
        };
      })
      .filter((x) => x.exercise_name);

    items.sort((a, b) => a.exercise_name.localeCompare(b.exercise_name));

    return res.status(200).json({
      ok: true,
      exercises: items,
      names: items.map((x) => x.exercise_name),
    });
  } catch (err: any) {
    console.error("[strength/exercises/list] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to list strength exercises" });
  }
}
