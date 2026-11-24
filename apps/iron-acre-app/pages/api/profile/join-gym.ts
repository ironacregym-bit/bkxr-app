// pages/api/profile/join-gym.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Timestamp } from "@google-cloud/firestore";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

type Body = {
  gym_id?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok: true; gym_id: string } | { error: string }>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authSession = await getServerSession(req, res, authOptions);
    const email = String(authSession?.user?.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = (req.body || {}) as Body;
    const gymId = String(body.gym_id || "").trim();

    if (!gymId) {
      return res.status(400).json({ error: "gym_id is required" });
    }

    const gymDoc = await firestore.collection("gyms").doc(gymId).get();

    if (!gymDoc.exists) {
      return res.status(400).json({ error: "Selected gym does not exist" });
    }

    const now = Timestamp.now();

    await firestore.collection("users").doc(email).set(
      {
        gym_id: gymId,
        updated_at: now,
        gym_joined_at: now,
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      gym_id: gymId,
    });
  } catch (err: any) {
    console.error("[profile/join-gym]", err?.message || err);
    return res.status(500).json({ error: "Failed to join gym" });
  }
}
