
// pages/api/exercises/media.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";
import { FieldPath } from "firebase-admin/firestore";

type MediaRow = { exercise_name: string; video_url: string };

function normalise(
  d: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>
): { id: string; exercise_name: string; video_url: string } {
  const id = d.id;
  const x = (d.data() || {}) as any;
  const exercise_name =
    (typeof x.exercise_name === "string" && x.exercise_name.trim()) ||
    (typeof x.name === "string" && x.name.trim()) ||
    id;
  const video_url = typeof x.video_url === "string" ? x.video_url : "";
  return { id, exercise_name, video_url };
}

// Firestore supports up to 10 values in an 'in' clause → chunk.
function chunk<T>(arr: T[], size = 10): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    let ids: string[] = [];
    if (req.method === "GET") {
      const raw = String(req.query.ids || "").trim();
      if (raw) ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (req.method === "POST") {
      const body = (req.body || {}) as any;
      if (Array.isArray(body.ids)) {
        ids = body.ids.map((s: any) => String(s || "").trim()).filter(Boolean);
      }
    } else {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!ids.length) {
      return res.status(400).json({ error: "ids required (comma-separated in GET or array in POST)" });
    }

    // Reasonable upper bound to avoid abuse; adjust as needed
    const MAX = 100;
    ids = Array.from(new Set(ids)).slice(0, MAX);

    const media: Record<string, MediaRow> = {};
    const missing = new Set(ids);

    const col = firestore.collection("exercises");
    const batches = chunk(ids, 10);

    for (const group of batches) {
      const snap = await col.where(FieldPath.documentId(), "in", group).get();
      snap.forEach((doc) => {
        const n = normalise(doc);
        media[n.id] = { exercise_name: n.exercise_name, video_url: n.video_url };
        missing.delete(n.id);
      });
    }

    return res.status(200).json({
      media,
      missing: Array.from(missing),
      count: Object.keys(media).length,
    });
  } catch (e: any) {
    console.error("[exercises/media] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to fetch exercise media" });
  }
}
