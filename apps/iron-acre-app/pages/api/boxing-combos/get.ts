// pages/api/boxing-combos/get.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

function normalise(d: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>) {
  const id = d.id;
  const x = (d.data() || {}) as any;

  const combo_name = (typeof x.combo_name === "string" && x.combo_name.trim()) || id;
  const category = (typeof x.category === "string" && x.category) || "Basics";
  const difficulty = typeof x.difficulty === "number" ? x.difficulty : null;
  const video_url = typeof x.video_url === "string" ? x.video_url : "";
  const notes = typeof x.notes === "string" ? x.notes : "";
  const actions = Array.isArray(x.actions) ? x.actions : [];

  const created_at = x.created_at?.toDate?.() instanceof Date ? x.created_at.toDate().toISOString() : (x.created_at || null);
  const updated_at = x.updated_at?.toDate?.() instanceof Date ? x.updated_at.toDate().toISOString() : (x.updated_at || null);

  return {
    id,
    combo_name,
    category,
    difficulty,
    video_url,
    notes,
    actions,
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
    const ref = firestore.collection("boxing_combos").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Not found" });
    return res.status(200).json({ combo: normalise(snap) });
  } catch (e: any) {
    console.error("[boxing-combos/get] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to load boxing combo" });
  }
}
