import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../auth/[...nextauth]";
import firestore from "../../../../../lib/firestoreClient";
import { hasRole } from "../../../../../lib/rbac";

type DayName =
  | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

const DAYS: DayName[] = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

function isEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || "").trim());
}
function parseYMDorISOToDate(s: string): Date | null {
  if (!s) return null;
  // Allow YYYY-MM-DD or full ISO
  const iso = s.length === 10 ? `${s}T12:00:00` : s;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !hasRole(session, ["admin", "gym"])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = (req.body || {}) as Record<string, any>;
  const user_email = String(body.user_email || "").trim().toLowerCase();
  const workout_id = String(body.workout_id || "").trim();
  const recurring_day = String(body.recurring_day || "").trim() as DayName;
  const start_date_raw = String(body.start_date || "");
  const end_date_raw = String(body.end_date || "");
  const note = body.note != null ? String(body.note) : null;

  if (!isEmail(user_email)) return res.status(400).json({ error: "Invalid user_email" });
  if (!workout_id) return res.status(400).json({ error: "workout_id is required" });
  if (!DAYS.includes(recurring_day)) return res.status(400).json({ error: "Invalid recurring_day" });

  const start_date = parseYMDorISOToDate(start_date_raw);
  const end_date = parseYMDorISOToDate(end_date_raw);
  if (!start_date || !end_date) return res.status(400).json({ error: "Invalid start/end date" });
  if (start_date.getTime() > end_date.getTime()) {
    return res.status(400).json({ error: "start_date must be on/before end_date" });
  }

  // Optional: sanity check workout exists (non-fatal if transient)
  try {
    const wRef = firestore.collection("workouts").doc(workout_id);
    const wSnap = await wRef.get();
    if (!wSnap.exists) return res.status(404).json({ error: "Workout not found" });
  } catch {
    // continue
  }

  try {
    const col = firestore.collection("workout_assignments");
    const docRef = col.doc();
    const now = new Date();

    const payload = {
      assignment_id: docRef.id,
      user_email,
      workout_id,
      recurring_day,
      start_date,               // Firestore converts Date -> Timestamp
      end_date,                 // Firestore converts Date -> Timestamp
      status: "active" as const,
      created_at: now,
      created_by: ((session.user as any)?.email || null) as string | null,
      note: note || null,
    };

    await docRef.set(payload, { merge: true });

    return res.status(201).json({ ok: true, assignment_id: docRef.id });
  } catch (err: any) {
    console.error("[admin/members/workouts/assign] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to create assignment" });
  }
}
