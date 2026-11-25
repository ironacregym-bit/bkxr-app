// /pages/api/admin/workouts/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";
import { hasRole } from "../../../../lib/rbac";

type WorkoutListItem = {
  workout_id: string;
  workout_name: string;
  workout_type?: string | null;
  focus?: string | null;
  visibility: "global" | "private";
  owner_email?: string | null;
  is_benchmark?: boolean;
  updated_at?: string | null;
  created_at?: string | null;
};

function toISO(ts: any): string | null {
  try {
    if (typeof ts?.toDate === "function") return ts.toDate().toISOString();
    if (typeof ts === "string") return ts;
  } catch {}
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !hasRole(session, ["admin", "gym"])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const me = (session.user as any)?.email?.toLowerCase?.() || "";

  const rawLimit = Number(req.query.limit || 50);
  const limit = Math.min(Number.isFinite(rawLimit) ? rawLimit : 50, 100);
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;

  try {
    let q: FirebaseFirestore.Query = firestore
      .collection("workouts")
      .where("workout_type", "==", "gym_custom")
      .orderBy("__name__")
      .limit(limit);

    if (cursor) q = q.startAfter(cursor);

    const snap = await q.get();

    const items: WorkoutListItem[] = [];

    for (const d of snap.docs) {
      const x = d.data() as any;
      const vis = (x.visibility as string) || "global";
      const owner = (x.owner_email as string) || null;

      // Show if global, or private owned by the current admin/gym
      const visible =
        vis === "global" || (vis === "private" && owner && me && owner.toLowerCase() === me);

      if (!visible) continue;

      items.push({
        workout_id: d.id,
        workout_name: x.workout_name || d.id,
        workout_type: x.workout_type ?? null,
        focus: x.focus ?? null,
        visibility: vis as "global" | "private",
        owner_email: owner,
        is_benchmark: !!x.is_benchmark,
        updated_at: toISO(x.updated_at),
        created_at: toISO(x.created_at),
      });
    }

    const nextCursor = snap.docs.length === limit ? snap.docs[snap.docs.length - 1].id : null;

    return res.status(200).json({ items, nextCursor });
  } catch (err: any) {
    console.error("[admin/workouts/list] error:", err?.message || err);
    return res.status(500).json({ error: "Server error" });
  }
}
