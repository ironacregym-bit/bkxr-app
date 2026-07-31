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
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session || !hasRole(session, ["admin", "gym"])) {
    return res.status(403).json({
      error: "Forbidden",
    });
  }

  const { block_id } = req.body || {};

  if (!block_id) {
    return res.status(400).json({
      error: "Missing block_id",
    });
  }

  await firestore
    .collection("farmstrong_settings")
    .doc("current")
    .set(
      {
        active_block_id: block_id,
        updated_at: Timestamp.now(),
      },
      { merge: true }
    );

  return res.status(200).json({
    ok: true,
  });
}
