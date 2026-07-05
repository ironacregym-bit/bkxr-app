import { Timestamp } from "@google-cloud/firestore";
import firestore from "./firestoreClient";
import { notifyInAppAndPush } from "./notify";

type AssignProgramInput = {
  userEmail: string;
  gymId?: string | null;
  programId: string;
  startDate?: Date | string | null;
  note?: string | null;
  createdBy?: string | null;
  sendNotification?: boolean;
  skipIfAlreadyActive?: boolean;
};

export type AssignProgramResult = {
  ok: true;
  unchanged: boolean;
  assignment_id: string | null;
  user_email: string;
  gym_id: string;
  program_id: string;
  program_name: string;
  weeks: number;
  start_date: string;
  end_date: string;
};

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || "").trim());
}

function parseDateInput(value?: Date | string | null): Date {
  if (value instanceof Date && !isNaN(value.getTime())) {
    const d = new Date(value);
    d.setHours(12, 0, 0, 0);
    return d;
  }

  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [year, month, day] = trimmed.split("-").map((x) => Number(x));
      const d = new Date(year, month - 1, day, 12, 0, 0, 0);

      if (!isNaN(d.getTime())) {
        return d;
      }
    }

    const parsed = new Date(trimmed);

    if (!isNaN(parsed.getTime())) {
      parsed.setHours(12, 0, 0, 0);
      return parsed;
    }
  }

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return today;
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

/**
 * Week should be based on full 7-day blocks from the assigned start date.
 *
 * Example:
 * Start Friday:
 * - Friday = Week 1
 * - Saturday/Sunday = Week 1
 * - Following Monday = Week 1
 * - Next Friday after 7 days = Week 2
 */
export function calculateProgramWeekFromStart(
  startDateInput: Date | string | null | undefined,
  atInput: Date | string = new Date()
) {
  const startDate = parseDateInput(startDateInput || null);
  const atDate = parseDateInput(atInput);

  const oneDayMs = 24 * 60 * 60 * 1000;
  const elapsedDays = Math.floor((atDate.getTime() - startDate.getTime()) / oneDayMs);

  if (elapsedDays < 0) return 1;

  return Math.floor(elapsedDays / 7) + 1;
}

async function getProgramSnap(programId: string) {
  const directRef = firestore.collection("programs").doc(programId);
  const directSnap = await directRef.get();

  if (directSnap.exists) {
    return directSnap;
  }

  const querySnap = await firestore
    .collection("programs")
    .where("program_id", "==", programId)
    .limit(1)
    .get();

  return querySnap.docs[0] || null;
}

async function isCurrentAssignmentActuallyActive(assignmentId: string | null) {
  if (!assignmentId) return false;

  try {
    const snap = await firestore.collection("program_assignments").doc(assignmentId).get();

    if (!snap.exists) return false;

    const data = snap.data() as any;

    return String(data?.status || "").toLowerCase() === "active";
  } catch {
    return false;
  }
}

export async function assignProgramToMember(
  input: AssignProgramInput
): Promise<AssignProgramResult> {
  const userEmail = String(input.userEmail || "").trim().toLowerCase();
  const requestedProgramId = String(input.programId || "").trim();
  const gymId = String(input.gymId || "g1").trim() || "g1";
  const note = input.note != null ? String(input.note) : null;
  const createdBy = input.createdBy ? String(input.createdBy).trim().toLowerCase() : null;
  const sendNotification = input.sendNotification === true;
  const skipIfAlreadyActive = input.skipIfAlreadyActive !== false;

  if (!isEmail(userEmail)) {
    throw new Error("Invalid user_email");
  }

  if (!requestedProgramId) {
    throw new Error("program_id is required");
  }

  if (!gymId) {
    throw new Error("gym_id is required");
  }

  const userRef = firestore.collection("users").doc(userEmail);
  const gymRef = firestore.collection("gyms").doc(gymId);

  const [userSnap, gymSnap, programSnap] = await Promise.all([
    userRef.get(),
    gymRef.get(),
    getProgramSnap(requestedProgramId),
  ]);

  if (!userSnap.exists) {
    throw new Error("User not found");
  }

  if (!gymSnap.exists) {
    throw new Error("Gym not found");
  }

  if (!programSnap || !programSnap.exists) {
    throw new Error("Program not found");
  }

  const userData = userSnap.data() as any;
  const programData = programSnap.data() as any;

  const resolvedProgramId = String(programData?.program_id || programSnap.id);
  const programName = String(programData?.name || programData?.title || resolvedProgramId);
  const weeks = Number(programData?.weeks || 12);

  if (!Number.isFinite(weeks) || weeks < 1) {
    throw new Error("Program has invalid weeks value");
  }

  const activeProgramId = String(userData?.active_program_id || "").trim();
  const activeAssignmentId = userData?.active_program_assignment_id
    ? String(userData.active_program_assignment_id)
    : null;

  const currentAssignmentIsActive = await isCurrentAssignmentActuallyActive(activeAssignmentId);

  /**
   * Only skip if:
   * - same selected program
   * - active assignment id exists
   * - active assignment document is actually active
   *
   * This prevents a stale user.active_program_id from blocking reassignment.
   */
  if (
    skipIfAlreadyActive &&
    activeProgramId === resolvedProgramId &&
    activeAssignmentId &&
    currentAssignmentIsActive
  ) {
    return {
      ok: true,
      unchanged: true,
      assignment_id: activeAssignmentId,
      user_email: userEmail,
      gym_id: gymId,
      program_id: resolvedProgramId,
      program_name: programName,
      weeks,
      start_date: userData?.active_program_start_date?.toDate
        ? userData.active_program_start_date.toDate().toISOString()
        : new Date().toISOString(),
      end_date: userData?.active_program_end_date?.toDate
        ? userData.active_program_end_date.toDate().toISOString()
        : new Date().toISOString(),
    };
  }

  const startDate = parseDateInput(input.startDate);
  const endDate = addWeeks(startDate, weeks);

  endDate.setDate(endDate.getDate() - 1);
  endDate.setHours(23, 59, 59, 999);

  const now = Timestamp.now();
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
          status: "overwritten",
          is_active: false,
          updated_at: now,
          overwritten_at: now,
          overwritten_by_assignment_id: assignmentRef.id,
          overwritten_by_program_id: resolvedProgramId,
          overwritten_by_program_name: programName,
          overwritten_reason: "Program reassigned",
          ended_by_reassignment: true,
        },
        { merge: true }
      );
    }

    tx.set(assignmentRef, {
      assignment_id: assignmentRef.id,
      user_email: userEmail,
      gym_id: gymId,
      program_id: resolvedProgramId,
      program_name: programName,

      start_date: Timestamp.fromDate(startDate),
      end_date: Timestamp.fromDate(endDate),
      weeks,

      week_calculation: "elapsed_days_from_start",
      current_week: 1,

      status: "active",
      is_active: true,
      created_at: now,
      updated_at: now,
      created_by: createdBy,
      note: note || null,
    });

    tx.set(
      userRef,
      {
        gym_id: gymId,

        program_id: resolvedProgramId,
        program_name: programName,
        workout_type: resolvedProgramId,

        active_program_assignment_id: assignmentRef.id,
        active_program_id: resolvedProgramId,
        active_program_name: programName,
        active_program_status: "active",
        active_program_start_date: Timestamp.fromDate(startDate),
        active_program_end_date: Timestamp.fromDate(endDate),

        active_program_week_calculation: "elapsed_days_from_start",
        active_program_current_week: 1,

        updated_at: now,
      },
      { merge: true }
    );
  });

  if (sendNotification) {
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
            program_id: resolvedProgramId,
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
      console.error("[programAssignments] notify error:", notifyErr?.message || notifyErr);
    }
  }

  return {
    ok: true,
    unchanged: false,
    assignment_id: assignmentRef.id,
    user_email: userEmail,
    gym_id: gymId,
    program_id: resolvedProgramId,
    program_name: programName,
    weeks,
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
  };
}
