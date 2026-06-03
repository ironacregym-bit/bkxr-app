// pages/api/admin/members/programs/assign.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { Timestamp } from "@google-cloud/firestore";
import { authOptions } from "../../../auth/[...nextauth]";
import firestore from "../../../../../lib/firestoreClient";
import { hasRole } from "../../../../../lib/rbac";
import { notifyInAppAndPush } from "../../../../../lib/notify";

type Body = {
  user_email?: string;
  gym_id?: string;
  program_id?: string;
  start_date?: string;
  note?: string | null;
};

function isEmail(s: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || "").trim());
}

function parseYMDToDate(value: string): Date | null {
  if (!value) return null;

  const [year, month, day] = value.split("-").map((x) => Number(x));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
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

function formatDateOnly(value: Date): string {
  try {
    return value.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value.toISOString().slice(0, 10);
  }
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
    const programId = String(body.program_id || "").trim();
    const note = body.note != null ? String(body.note) : null;

    if (!isEmail(userEmail)) {
      return res.status(400).json({ error: "Invalid user_email" });
    }

    if (!gymId) {
      return res.status(400).json({ error: "gym_id is required" });
    }

    if (!programId) {
      return res.status(400).json({ error: "program_id is required" });
    }

    const startDate = parseYMDToDate(String(body.start_date || ""));
    if (!startDate) {
      return res.status(400).json({ error: "Valid start_date is required (YYYY-MM-DD)" });
    }

    const userRef = firestore.collection("users").doc(userEmail);
    const gymRef = firestore.collection("gyms").doc(gymId);
    const programRef = firestore.collection("programs").doc(programId);

    const [userSnap, gymSnap, programSnap] = await Promise.all([
      userRef.get(),
      gymRef.get(),
      programRef.get(),
    ]);

    if (!userSnap.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!gymSnap.exists) {
      return res.status(404).json({ error: "Gym not found" });
    }

    if (!programSnap.exists) {
      return res.status(404).json({ error: "Program not found" });
    }

    const programData = programSnap.data() as any;
    const programName = String(programData?.name || programId);
    const weeks = Number(programData?.weeks || 12);

    if (!Number.isFinite(weeks) || weeks < 1) {
      return res.status(400).json({ error: "Program has invalid weeks value" });
    }

    const endDate = addWeeks(startDate, weeks);
    endDate.setDate(endDate.getDate() - 1);
    endDate.setHours(23, 59, 59, 999);

    const now = Timestamp.now();
    const createdBy = String((session.user as any)?.email || "").trim().toLowerCase() || null;

    const assignmentRef = firestore.collection("program_assignments").doc();

    await firestore.runTransaction(async (tx) => {
      const existingAssignmentsQuery = firestore
        .collection("program_assignments")
        .where("user_email", "==", userEmail)
        .where("status", "==", "active");

      const existingAssignmentsSnap = await tx.get(existingAssignmentsQuery);

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
        program_id: programId,
        program_name: programName,
        start_date: Timestamp.fromDate(startDate),
        end_date: Timestamp.fromDate(endDate),
        weeks,
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
          active_program_assignment_id: assignmentRef.id,
          active_program_id: programId,
          active_program_name: programName,
          active_program_status: "active",
          active_program_start_date: Timestamp.fromDate(startDate),
          active_program_end_date: Timestamp.fromDate(endDate),
          updated_at: now,
        },
        { merge: true }
      );
    });

    // Send notification after successful transaction
    try {
      const href = "/iron-acre";
      const startText = formatDateOnly(startDate);

      await notifyInAppAndPush(
        userEmail,
        {
          title: "Program assigned",
          message: `You’ve been added to ${programName}. Your training block starts on ${startText}. Tap to open Iron Acre and view your programme.`,
          href,
          source_key: "program_assignment",
          source_event: "program_assigned",
          meta: {
            gym_id: gymId,
            program_id: programId,
            program_name: programName,
            assignment_id: assignmentRef.id,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
          },
        },
        {
          title: "Program assigned",
          body: `You’ve been added to ${programName}. Tap to view your training block.`,
          url: href,
        }
      );
    } catch (notifyErr: any) {
      console.error("[admin/members/programs/assign] notify error:", notifyErr?.message || notifyErr);
    }

    return res.status(201).json({
      ok: true,
      assignment_id: assignmentRef.id,
      user_email: userEmail,
      gym_id: gymId,
      program_id: programId,
      program_name: programName,
      weeks,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    });
  } catch (err: any) {
    console.error("[admin/members/programs/assign] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to assign program" });
  }
}
