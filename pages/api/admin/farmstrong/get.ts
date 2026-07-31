import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";
import { hasRole } from "../../../../lib/rbac";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !hasRole(session, ["admin", "gym"])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const [blocksSnap, exercisesSnap, programsSnap, currentSnap] =
      await Promise.all([
        firestore.collection("farmstrong_blocks").get(),
        firestore.collection("strength_exercises").get(),
        firestore.collection("programs").get(),
        firestore.collection("farmstrong_settings").doc("current").get(),
      ]);

    const blocks = blocksSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() || {}),
    }));

    const exercises = exercisesSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() || {}),
    }));

    const programs = programsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() || {}),
    }));

    return res.status(200).json({
      activeBlockId:
        currentSnap.exists
          ? currentSnap.data()?.active_block_id || null
          : null,
      blocks,
      exercises,
      programs,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({
      error: "Failed to load Farm Strong config",
    });
  }
}
