
// pages/api/exercises/create.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      exercise_name,
      type,
      equipment,
      video_url,
      met_value,       // number
      description,
    } = req.body || {};

    if (!exercise_name || typeof exercise_name !== "string") {
      return res.status(400).json({ error: "exercise_name is required" });
    }

    const now = Timestamp.now();
    const ref = firestore.collection("exercises").doc();

    await ref.set({
      exercise_name: exercise_name.trim(),
      type: (type || "").trim(),
      equipment: (equipment || "").trim(),
      video_url: (video_url || "").trim(),
      met_value: typeof met_value === "number" ? met_value : null,
      description: (description || "").trim(),
      created_at: now,
      updated_at: now,
    });

       return res.status(201).json({ ok: true, id: ref.id });
  } catch (err: any) {
    console.error("[exercises/create] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to create exercise" });
  }
}
