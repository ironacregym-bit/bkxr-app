
// pages/api/exercises/media.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";
import { FieldPath } from "@google-cloud/firestore"; // <-- Correct import for server env

type MediaRow = {
  exercise_name: string;
  video_url?: string;
  gif_url?: string;
};

function normalise(
  d: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>
) {
  const id = d.id;
  const x = (d.data() || {}) as any;

  return {
    id,
    exercise_name:
      (typeof x.exercise_name === "string" && x.exercise_name.trim()) ||
      id,
    video_url: typeof x.video_url === "string" ? x.video_url : undefined,
    gif_url: typeof x.gif_url === "string" ? x.gif_url : undefined,
  };
}

// Chunk sizes for "in" queries
function chunk<T>(arr: T[], size = 10): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    /** Extract IDs from GET or POST */
    let ids: string[] = [];

    if (req.method === "GET") {
      const raw = String(req.query.ids || "").trim();
      if (raw) {
        ids = raw
          .split(",")
          .map((s) => decodeURIComponent(s).trim())
          .filter(Boolean);
      }
    } else if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (Array.isArray(body?.ids)) {
        ids = body.ids.map((x: any) => String(x || "").trim()).filter(Boolean);
      }
    } else {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (!ids.length) {
      return res.status(400).json({ error: "ids required" });
    }

    // Dedup + limit
    ids = Array.from(new Set(ids)).slice(0, 100);

    const exercisesCol = firestore.collection("exercises");
    const batches = chunk(ids, 10);

    const media: Record<
      string,
      { exercise_name: string; video_url?: string; gif_url?: string }
    > = {};

    const found = new Set<string>();

    /** ---- FIRST PASS: docId IN query ---- */
    for (const group of batches) {
      const snap = await exercisesCol
        .where(FieldPath.documentId(), "in", group)
        .get();

      snap.forEach((doc) => {
        const n = normalise(doc);
        media[n.id] = {
          exercise_name: n.exercise_name,
          video_url: n.video_url,
          gif_url: n.gif_url,
        };
        found.add(n.id);
      });
    }

    /** Missing ones */
    const missing = ids.filter((id) => !found.has(id));

    /** ---- SECOND PASS: name match fallback ---- */
    // Helps when exercise_id was saved as "Leg Press" but doc ID is "Leg Press Machine"
    for (const name of missing) {
      const q = await exercisesCol
        .where("exercise_name", "==", name)
        .limit(1)
        .get();

      const doc = q.docs[0];
      if (doc) {
        const n = normalise(doc);
        // Key by the original 'name' passed in
        media[name] = {
          exercise_name: n.exercise_name,
          video_url: n.video_url,
          gif_url: n.gif_url,
        };
        continue;
      }
    }

    const stillMissing = ids.filter((id) => !(id in media));

    return res.status(200).json({
      media,
      missing: stillMissing,
      count: Object.keys(media).length,
    });
  } catch (err: any) {
    console.error("[exercises/media] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch exercise media" });
  }
}
