import type { NextApiRequest, NextApiResponse } from "next";
import { Timestamp } from "@google-cloud/firestore";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";
import { hasRole } from "../../../../lib/rbac";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || !hasRole(session, ["admin", "gym"])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const {
      block_id,
      name,
      focus,
      description,
      weeks,
      program_id,
      exercise_ids,
    } = req.body || {};

    const ref = block_id
      ? firestore.collection("farmstrong_blocks").doc(block_id)
      : firestore.collection("farmstrong_blocks").doc();

    await ref.set(
      {
        block_id: ref.id,
        name: String(name || ""),
        focus: String(focus || ""),
        description: String(description || ""),
        weeks: Number(weeks || 8),
        program_id: program_id || "",
        exercise_ids: Array.isArray(exercise_ids)
          ? exercise_ids
          : [],
        updated_at: Timestamp.now(),
        updated_by:
          String(session.user?.email || "").toLowerCase(),
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      block_id: ref.id,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({
      error: "Failed to save block",
    });
  }
}
