
// pages/api/exercises/get.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

function normalise(d: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>) {
  const id = d.id;
  const x = (d.data() || {}) as any;
  const exercise_name =
    (typeof x.exercise_name === "string" && x.exercise_name.trim()) ||
    (typeof x.name === "string" && x.name.trim()) ||
    id;
  const type = typeof x.type === "string" ? x.type : (typeof x.category === "string" ? x.category : "");
  const equipment = typeof x.equipment === "string" ? x.equipment : "";
  const video_url = typeof x.video_url === "string" ? x.video_url : "";
  const met_value =
    typeof x.met_value === "number"
      ? x.met_value
      : Number.isFinite(Number(x.met_value))
      ? Number(x.met_value)
      : null;

  const created_at = x.created_at?.toDate?.() instanceof Date ? x.created_at.toDate().toISOString() : (x.created_at || null);
  const updated_at = x.updated_at?.toDate?.() instanceof Date ? x.updated_at.toDate().toISOString() : (x.updated_at || null);

  return {
    id,
    exercise_name,
    type,
    equipment,
    video_url,
    met_value,
    description: typeof x.description === "string" ? x.description : "",
    created_at,
    updated_at,
    created_by: x.created_by || null,
    last_modified_by: x.last_modified_by || null,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const session = await getServerSession(req, res, authOptions);
  const role = (session?.user as any)?.role || "user";
  if (!session?.user?.email || (role !== "admin" && role !== "gym")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const id = String(req.query.id || "").trim();
  if (!id) return res.status(400).json({ error: "Missing id" });

  try {
    const ref = firestore.collection("exercises").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Not found" });
    return res.status(200).json({ exercise: normalise(snap) });
  } catch (e: any) {
    console.error("[exercises/get] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to load exercise" });
  }
}
