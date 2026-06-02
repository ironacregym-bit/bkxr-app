// pages/api/admin/members/plans/assign.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { Timestamp } from "@google-cloud/firestore";
import { authOptions } from "../../../auth/[...nextauth]";
import firestore from "../../../../../lib/firestoreClient";
import { hasRole } from "../../../../../lib/rbac";

type PlanKey = "farm_strength" | "kettlebells";

type Body = {
  user_email?: string;
  gym_id?: string;
  plan_key?: PlanKey;
  start_date?: string;
  note?: string | null;
};

const PLAN_LABELS: Record<PlanKey, string> = {
  farm_strength: "Farm Strength",
  kettlebells: "Kettlebells",
};

const DURATION_WEEKS = 12;

function isEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || "").trim());
}

function parseYMDToDate(value: string): Date | null {
  if (!value) return null;

  const [year, month, day] = value.split("-").map((x) => Number(x));
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }

  const d = new Date(year, month - 1, day, 12, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
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

  try {
    const body = (req.body || {}) as Body;

    const userEmail = String(body.user_email || "").trim().toLowerCase();
    const gymId = String(body.gym_id || "").trim();
    const planKey = String(body.plan_key || "").trim() as PlanKey;
    const note = body.note != null ? String(body.note) : null;

    if (!isEmail(userEmail)) {
      return res.status(400).json({ error: "Invalid user_email" });
    }

    if (!gymId) {
      return res.status(400).json({ error: "gym_id is required" });
    }

    if (planKey !== "farm_strength" && planKey !== "kettlebells") {
      return res.status(400).json({ error: "Invalid plan_key" });
    }

    const startDate = parseYMDToDate(String(body.start_date || ""));
    if (!startDate) {
      return res.status(400).json({ error: "Valid start_date is required (YYYY-MM-DD)" });
    }

    const endDate = addWeeks(startDate, DURATION_WEEKS);
    endDate.setDate(endDate.getDate() - 1);
    endDate.setHours(23, 59, 59, 999);

    const userRef = firestore.collection("users").doc(userEmail);
    const gymRef = firestore.collection("gyms").doc(gymId);

    const [userSnap, gymSnap] = await Promise.all([userRef.get(), gymRef.get()]);

    if (!userSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!gymSnap.exists) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const now = Timestamp.now();
    const createdBy = String((session.user as any)?.email || "").trim().toLowerCase() || null;
    const planName = PLAN_LABELS[planKey];

    const assignmentRef = firestore.collection("gym_plan_assignments").doc();

    await firestore.runTransaction(async (tx) => {
      // End any existing active gym plan assignments for this user
      const existingAssignmentsSnap = await tx.get(
        firestore
          .collection("gym_plan_assignments")
          .where("user_email", "==", userEmail)
          .where("status", "==", "active")
      );

      for (const doc of existingAssignmentsSnap.docs) {
        tx.set(
          doc.ref,
          {
            status: "completed",
            updated_at: now,
            ended_by_reassignment: true,
          },
          { merge: true }
        );
      }

      tx.set(assignmentRef, {
        assignment_id: assignmentRef.id,
        user_email: userEmail,
        gym_id: gymId,
        plan_key: planKey,
        plan_name: planName,
        duration_weeks: DURATION_WEEKS,
        start_date: Timestamp.fromDate(startDate),
        end_date: Timestamp.fromDate(endDate),
        status: "active",
        created_at: now,
        updated_at: now,
        created_by: createdBy,
        note: note || null,
      });

      tx.set(
        userRef,
        {
          gym_id: gymId,
          active_gym_plan_id: assignmentRef.id,
          active_gym_plan_key: planKey,
          active_gym_plan_name: planName,
          active_gym_plan_status: "active",
          active_gym_plan_start_date: Timestamp.fromDate(startDate),
          active_gym_plan_end_date: Timestamp.fromDate(endDate),
          updated_at: now,
        },
        { merge: true }
      );
    });

    return res.status(201).json({
      ok: true,
      assignment_id: assignmentRef.id,
      user_email: userEmail,
      gym_id: gymId,
      plan_key: planKey,
      plan_name: planName,
      duration_weeks: DURATION_WEEKS,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    });
  } catch (err: any) {
    console.error("[admin/members/plans/assign] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to assign gym plan" });
  }
}
