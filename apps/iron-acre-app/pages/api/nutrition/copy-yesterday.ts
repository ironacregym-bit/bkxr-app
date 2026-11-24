import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

function ymdMinusOne(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

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

  if (!session?.user?.email) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  try {
    const email = String(session.user.email);
    const targetDate = String(req.body?.date || "");

    if (!targetDate) {
      return res.status(400).json({
        error: "Missing date",
      });
    }

    const previousDate = ymdMinusOne(targetDate);

    const previousSnap = await firestore
      .collection("nutrition_logs")
      .doc(email)
      .collection(previousDate)
      .get();

    if (previousSnap.empty) {
      return res.status(404).json({
        error: "No nutrition entries yesterday",
      });
    }

    const batch = firestore.batch();

    previousSnap.docs.forEach((doc) => {
      const data = doc.data();

      const newRef = firestore
        .collection("nutrition_logs")
        .doc(email)
        .collection(targetDate)
        .doc();

      batch.set(newRef, {
        ...data,
        created_at: new Date().toISOString(),
      });
    });

    await batch.commit();

    return res.status(200).json({
      ok: true,
      copied: previousSnap.size,
    });
  } catch (err: any) {
    console.error(
      "[nutrition/copy-yesterday]",
      err?.message || err
    );

    return res.status(500).json({
      error: "Failed to copy nutrition",
    });
  }
}
