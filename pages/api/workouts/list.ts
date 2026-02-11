// pages/api/workouts/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient"; // server Firestore (@google-cloud/firestore)

type WorkoutRow = {
  workout_id: string;
  workout_name: string;
  visibility?: "global" | "private";
  focus?: string | null;
  notes?: string | null;
  owner_email?: string | null;
  kind: "gym" | "bxkr";
  created_at?: any;
};

type ListResp = { items: WorkoutRow[] };

/** Strict discriminator:
 *  - workout_type === "gym_custom" => gym
 *  - otherwise default to bxkr
 */
function inferKind(data: FirebaseFirestore.DocumentData): "gym" | "bxkr" {
  const wt = String(data?.workout_type || "").toLowerCase();
  return wt === "gym_custom" ? "gym" : "bxkr";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ListResp | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = firestore;

    // Query params
    const q = (req.query.q as string)?.trim().toLowerCase() || "";
    const visibility = (req.query.visibility as string) || "";
    const limit = Math.min(parseInt(String(req.query.limit || "300"), 10) || 300, 1000);

    // Read newest first. We'll filter client-side to keep index requirements simple.
    const snap = await db
      .collection("workouts")
      .orderBy("created_at", "desc")
      .limit(limit)
      .get();

    const rows: WorkoutRow[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        workout_id: d.id,
        workout_name: data?.workout_name || "(unnamed)",
        visibility: data?.visibility || "global",
        focus: data?.focus ?? null,
        notes: data?.notes ?? null,
        owner_email: data?.owner_email ?? null,
        kind: inferKind(data),
        created_at: data?.created_at || null,
      };
    });

    // In-memory filters
    const filtered = rows.filter((r) => {
      const visOk = visibility ? r.visibility === visibility : true;
      const qOk = q
        ? (r.workout_name?.toLowerCase().includes(q) ||
           (r.focus || "").toLowerCase().includes(q))
        : true;
      return visOk && qOk;
    });

    return res.status(200).json({ items: filtered });
  } catch (e: any) {
    console.error("[workouts/list] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to list workouts" });
  }
}
