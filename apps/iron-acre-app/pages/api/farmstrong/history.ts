import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
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

  const exerciseId = String(
    req.query.exerciseId || ""
  ).trim();

  if (!exerciseId) {
    return res.status(400).json({
      error: "Missing exerciseId",
    });
  }

  try {
    const snap = await firestore
      .collection("strength_profiles")
      .doc(email)
      .collection("lifts")
      .doc(exerciseId)
      .collection("entries")
      .orderBy("recorded_at", "asc")
      .get();

    const entries = snap.docs.map((d) => {
      const x = d.data();

      return {
        id: d.id,
        value: Number(x.value || 0),
        recorded_at:
          x.recorded_at?.toDate?.()?.toISOString() ||
          null,
      };
    });

    return res.status(200).json({
      ok: true,
      entries,
    });
  } catch (err: any) {
    console.error(
      "[farmstrong/history]",
      err?.message || err
    );

    return res.status(500).json({
      error: "Failed to load history",
    });
  }
}
