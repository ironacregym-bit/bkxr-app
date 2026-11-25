
// pages/api/exercises/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

/**
 * Normalise a Firestore exercise doc into a stable shape for the UI.
 * Guarantees: id (string), exercise_name (string), type (string|""), equipment, video_url, met_value.
 */
function normaliseExercise(d: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>) {
  const id = d.id;
  const x = (d.data() || {}) as any;

  // Prefer explicit exercise_name; otherwise derive from common variants or ID fallback.
  const exercise_name =
    (typeof x.exercise_name === "string" && x.exercise_name.trim()) ||
    (typeof x.name === "string" && x.name.trim()) ||
    (typeof x.Name === "string" && x.Name.trim()) ||
    (x.exercise && typeof x.exercise.name === "string" && x.exercise.name.trim()) ||
    id; // last resort

  const type =
    (typeof x.type === "string" && x.type) ||
    (typeof x.Type === "string" && x.Type) ||
    (typeof x.category === "string" && x.category) ||
    "";

  const equipment = typeof x.equipment === "string" ? x.equipment : "";
  const video_url = typeof x.video_url === "string" ? x.video_url : "";
  const met_value =
    typeof x.met_value === "number"
      ? x.met_value
      : Number.isFinite(Number(x.met_value))
      ? Number(x.met_value)
      : null;

  return {
    id,
    exercise_name,
    type,
    equipment,
    video_url,
    met_value,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const { q, limit, type, cursor } = req.query as {
      q?: string;
      limit?: string;
      type?: string;
      cursor?: string; // doc id to start after
    };

    const n = Math.min(Math.max(Number(limit || 500), 1), 1000); // 1..1000

    let col = firestore.collection("exercises") as FirebaseFirestore.Query;

    // Optional filter by type (exact match on the 'type' field).
    // We don't add an orderBy on the same field to avoid composite index requirement.
    if (type && type.trim()) {
      col = col.where("type", "==", type.trim());
    }

    // Order by name for a stable list; if field is missing in some docs, Firestore allows ordering
    // but you may want to backfill that field later for perfect ordering.
    col = col.orderBy("exercise_name");

    // Pagination: if a cursor id is provided, read that doc and startAfter it.
    if (cursor && cursor.trim()) {
      const cursorDoc = await firestore.collection("exercises").doc(cursor.trim()).get();
      if (cursorDoc.exists) {
        col = col.startAfter(cursorDoc);
      }
    }

    col = col.limit(n);

    const snap = await col.get();

    // Map + normalise
    let exercises = snap.docs.map(normaliseExercise);

    // Optional simple filter (case-insensitive) applied *after* fetch,
    // matching exercise_name and type. This keeps the query simple/no new indexes.
    const qText = q?.toLowerCase().trim();
    if (qText) {
      exercises = exercises.filter(
        (e) =>
          e.exercise_name.toLowerCase().includes(qText) ||
          (e.type || "").toLowerCase().includes(qText)
      );
    }

    // Prepare next cursor (if any)
    const lastDoc = snap.docs[snap.docs.length - 1];
    const nextCursor = lastDoc ? lastDoc.id : null;

    return res.status(200).json({
      exercises,
      nextCursor, // pass this back to request the next page: ?cursor=nextCursor
    });
  } catch (err: any) {
    console.error("[exercises/index] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to list exercises" });
  }
}
