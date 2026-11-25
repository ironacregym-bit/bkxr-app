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

  const numericValue = Number(value);

  if (
    !exercise_id ||
    !exercise_name ||
    !Number.isFinite(numericValue)
  ) {
    return res.status(400).json({
      error: "Invalid data",
    });
  }

  try {
    const profileRef = firestore
      .collection("strength_profiles")
      .doc(email);

    const liftRef = profileRef
      .collection("lifts")
      .doc(exercise_id);

    const existingSnap = await liftRef.get();

    const existing = existingSnap.exists
      ? existingSnap.data() || {}
      : {};

    const existingBest = Number(
      existing?.best_true_1rm_kg || 0
    );

    await profileRef.set(
      {
        updated_at: Timestamp.now(),
      },
      { merge: true }
    );

    await liftRef.set(
      {
        exercise_name,
        training_max_kg: numericValue,
        best_true_1rm_kg: Math.max(
          existingBest,
          numericValue
        ),
        updated_at: Timestamp.now(),
      },
      { merge: true }
    );

    await liftRef.collection("entries").add({
      value: numericValue,
      recorded_at: Timestamp.now(),
    });

    return res.status(200).json({
      ok: true,
    });
  } catch (e: any) {
    console.error(
      "[farmstrong/update-lift]",
      e?.message || e
    );

    return res.status(500).json({
      error: "Failed to update lift",
    });
  }
}
