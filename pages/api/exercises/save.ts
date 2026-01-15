
// pages/api/exercises/save.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

function cleanString(v: any): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}
function cleanNumberOrNull(v: any): number | null | undefined {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const session = await getServerSession(req, res, authOptions);
  const role = (session?.user as any)?.role || "user";
  const userEmail = session?.user?.email || "";
  if (!userEmail || (role !== "admin" && role !== "gym")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const b = (req.body || {}) as Record<string, any>;
    const id = b.id ? String(b.id).trim() : undefined;

    // Required
    const exercise_name = cleanString(b.exercise_name);
    if (!exercise_name) return res.status(400).json({ error: "exercise_name is required" });

    // Optional
    const type = cleanString(b.type);
    const equipment = cleanString(b.equipment);
    const video_url = cleanString(b.video_url);
    const description = cleanString(b.description);
    const met_value = cleanNumberOrNull(b.met_value); // can be null to explicitly clear, or undefined to ignore

    const now = new Date();

    if (!id) {
      // CREATE
      const docRef = await firestore.collection("exercises").add({
        exercise_name,
        ...(type !== undefined && { type }),
        ...(equipment !== undefined && { equipment }),
        ...(video_url !== undefined && { video_url }),
        ...(description !== undefined && { description }),
        ...(met_value !== undefined && { met_value }), // allow null to set null explicitly
        created_at: now,
        updated_at: now,
        created_by: userEmail,
        last_modified_by: userEmail,
      });
      const snap = await docRef.get();
      return res.status(200).json({ ok: true, exercise: { id: snap.id, ...(snap.data() || {}) } });
    }

    // UPDATE (merge-style, non-empty only unless explicitly null for met_value)
    const ref = firestore.collection("exercises").doc(id);
    const updates: Record<string, any> = {
      exercise_name, // required -> always update
      updated_at: now,
      last_modified_by: userEmail,
    };
    if (type !== undefined) updates.type = type;
    if (equipment !== undefined) updates.equipment = equipment;
    if (video_url !== undefined) updates.video_url = video_url;
    if (description !== undefined) updates.description = description;
    if (met_value !== undefined) updates.met_value = met_value;

    await ref.set(updates, { merge: true });
    const snap = await ref.get();
    return res.status(200).json({ ok: true, exercise: { id, ...(snap.data() || {}) } });
  } catch (e: any) {
    console.error("[exercises/save] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to save exercise" });
  }
}
