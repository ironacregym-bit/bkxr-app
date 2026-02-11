// pages/api/workouts/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient"; // server Firestore (@google-cloud/firestore)

/** Base row used by existing consumers; we extend it with recurring fields below */
type WorkoutRowBase = {
  workout_id: string;
  workout_name: string;
  visibility?: "global" | "private";
  focus?: string | null;
  notes?: string | null;
  owner_email?: string | null;
  kind: "gym" | "bxkr";
  created_at?: any;
};

/** Extended row with recurring assignment shape (optional on documents) */
type WorkoutRow = WorkoutRowBase & {
  workout_type?: string | null;
  // Recurring assignment fields
  recurring?: boolean;
  recurring_day?: string | null;
  recurring_start?: any | null; // Firestore Timestamp or ISO string
  recurring_end?: any | null;   // Firestore Timestamp or ISO string
  assigned_to?: string[] | null;
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

    // Query params (all optional)
    const q = (req.query.q as string)?.trim().toLowerCase() || "";
    const visibility = (req.query.visibility as string) || "";
    const limit = Math.min(parseInt(String(req.query.limit || "300"), 10) || 300, 1000);

    // Optional server-side filter for recurring assignment by user email
    // e.g. /api/workouts/list?assigned_to_contains=user@example.com
    const assignedToContains =
      typeof req.query.assigned_to_contains === "string"
        ? (req.query.assigned_to_contains as string).trim().toLowerCase()
        : "";

    // Read newest first. We'll filter in-memory to keep index requirements simple.
    const snap = await db
      .collection("workouts")
      .orderBy("created_at", "desc")
      .limit(limit)
      .get();

    const rows: WorkoutRow[] = snap.docs.map((d) => {
      const data = d.data();
      const base: WorkoutRow = {
        workout_id: d.id,
        workout_name: data?.workout_name || "(unnamed)",
        visibility: data?.visibility || "global",
        focus: data?.focus ?? null,
        notes: data?.notes ?? null,
        owner_email: data?.owner_email ?? null,
        kind: inferKind(data),
        created_at: data?.created_at || null,

        // extra fields used by the weekly header for recurring expansion
        workout_type: data?.workout_type ?? null,
        recurring: Boolean(data?.recurring),
        recurring_day: data?.recurring_day ?? null,
        recurring_start: data?.recurring_start ?? null,
        recurring_end: data?.recurring_end ?? null,
        assigned_to: Array.isArray(data?.assigned_to) ? (data.assigned_to as string[]) : null,
      };
      return base;
    });

    // In-memory filters
    const filteredByVisAndQuery = rows.filter((r) => {
      const visOk = visibility ? r.visibility === visibility : true;
      const qOk = q
        ? (r.workout_name?.toLowerCase().includes(q) ||
            (r.focus || "").toLowerCase().includes(q))
        : true;
      return visOk && qOk;
    });

    const filteredByAssignee = assignedToContains
      ? filteredByVisAndQuery.filter((r) =>
          (r.assigned_to || []).some(
            (em) => String(em || "").toLowerCase() === assignedToContains
          )
        )
      : filteredByVisAndQuery;

    return res.status(200).json({ items: filteredByAssignee });
  } catch (e: any) {
    console.error("[workouts/list] error:", e?.message || e);
    return res.status(500).json({ error: "Failed to list workouts" });
  }
}
