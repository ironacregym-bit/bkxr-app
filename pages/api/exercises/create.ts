
// pages/api/exercises/create.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { Timestamp } from "@google-cloud/firestore";

/**
 * POST /api/exercises/create[?upsert=true]
 *
 * Body:
 * {
 *   exercise_id?: string;          // optional; defaults to exercise_name
 *   exercise_name: string;         // required
 *   type?: string;
 *   equipment?: string;
 *   video_url?: string;
 *   met_value?: number | null;
 *   description?: string;
 * }
 *
 * Behavior:
 * - Uses exercise_id as the Firestore doc ID (custom ID).
 * - If exercise_id omitted, it defaults to exercise_name (your rule).
 * - If doc exists:
 *   - upsert=true -> merges and updates updated_at
 *   - otherwise   -> 409 Conflict
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      exercise_id,
      exercise_name,
      type,
      equipment,
      video_url,
      met_value, // number | null
      description,
    } = req.body || {};

    // Basic validation
    if (!exercise_name || typeof exercise_name !== "string") {
      return res.status(400).json({ error: "exercise_name is required" });
    }

    // Per your rule: default ID = name (and keep them identical by default)
    const idRaw = (typeof exercise_id === "string" && exercise_id.trim().length > 0)
      ? exercise_id
      : exercise_name;

    const id = String(idRaw).trim();
    if (!id) {
      return res.status(400).json({ error: "exercise_id resolved empty" });
    }

    // Optional: reject IDs that are too long or unsafe (very light guard)
    if (id.length > 200) {
      return res.status(400).json({ error: "exercise_id too long (max 200 chars)" });
    }

    // Query flag: upsert
    const upsert = String(req.query.upsert || "").toLowerCase() === "true";

    const now = Timestamp.now();
    const ref = firestore.collection("exercises").doc(id);
    const snap = await ref.get();

    // Prepare record
    const record = {
      exercise_name: String(exercise_name).trim(),
      type: String(type || "").trim(),
      equipment: String(equipment || "").trim(),
      video_url: String(video_url || "").trim(),
      met_value: typeof met_value === "number" ? met_value : null,
      description: String(description || "").trim(),
      updated_at: now,
      // created_at set only on first write
    } as any;

    if (snap.exists) {
      if (!upsert) {
        return res.status(409).json({
          error: "Exercise already exists",
          exercise_id: id,
        });
      }
      // Merge while preserving created_at
      await ref.set(
        {
          ...record,
          created_at: snap.get("created_at") || now,
        },
        { merge: true }
      );
      return res.status(200).json({ ok: true, exercise_id: id, upserted: true });
    }

    // Create new
    await ref.set({
      ...record,
      created_at: now,
    });

    return res.status(201).json({ ok: true, exercise_id: id });
  } catch (err: any) {
    console.error("[exercises/create] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to create exercise" });
  }
}
