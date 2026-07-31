import type { NextApiRequest, NextApiResponse } from "next";
import { Timestamp } from "@google-cloud/firestore";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const session = await getServerSession(
    req,
    res,
    authOptions
  );

  const email = String(
    session?.user?.email || ""
  )
    .trim()
    .toLowerCase();

  if (!email) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  const {
    exercise_id,
    exercise_name,
    value,
  } = req.body || {};

  if (!exercise_id || value == null) {
    return res.status(400).json({
      error: "Missing fields",
    });
  }

  try {
    const liftRef = firestore
      .collection("strength_profiles")
      .doc(email)
      .collection("lifts")
      .doc(exercise_id);

    const snap = await liftRef.get();

    const current =
      snap.exists ? snap.data() || {} : {};

    const bestEver = Math.max(
      Number(current?.best_ever || 0),
      Number(value || 0)
    );

    await liftRef.set(
      {
        exercise_name:
          exercise_name || exercise_id,
        current_best: Number(value),
        best_ever: bestEver,
        updated_at: Timestamp.now(),
      },
      { merge: true }
    );

    await liftRef.collection("entries").add({
      value: Number(value),
      recorded_at: Timestamp.now(),
    });

    return res.status(200).json({
      ok: true,
    });
  } catch (err: any) {
    console.error(err);

    return res.status(500).json({
      error: "Failed to save lift",
    });
  }
}
