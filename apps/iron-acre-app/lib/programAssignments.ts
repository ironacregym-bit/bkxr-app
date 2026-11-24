import { Timestamp } from "@google-cloud/firestore";
import firestore from "./firestoreClient";
import { notifyInAppAndPush } from "./notify";

export type ProgramStartMode = "today" | "next_monday";

type AssignProgramInput = {
  userEmail: string;
  gymId?: string | null;
  programId: string;
  startDate?: Date | string | null;
  startMode?: ProgramStartMode | null;
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
  start_mode: ProgramStartMode;
  start_date: string;
  end_date: string;
};

function isEmail(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value || "").trim());
}

function normaliseDateToMidday(date: Date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

function dateToYMD(value: Date) {
  const d = normaliseDateToMidday(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateInput(value?: Date | string | null): Date {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return normaliseDateToMidday(value);
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
      return normaliseDateToMidday(parsed);
    }
  }

  return getProgramStartDate("today");
}

export function getProgramStartDate(mode: ProgramStartMode): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);

  if (mode === "today") {
    return d;
  }

  const day = d.getDay();
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7 || 7;

  d.setDate(d.getDate() + daysUntilMonday);
  return d;
}

function resolveStartMode(input: AssignProgramInput): ProgramStartMode {
  if (input.startMode === "today") return "today";
  if (input.startMode === "next_monday") return "next_monday";

  return input.startDate ? "today" : "next_monday";
}

function resolveStartDate(input: AssignProgramInput): Date {
  if (input.startDate) {
    return parseDateInput(input.startDate);
  }

  return getProgramStartDate(resolveStartMode(input));
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
 * Week is based on full 7-day blocks from the assigned start date.
 *
 * Start Friday:
 * - Friday to Thursday = Week 1
 * - Next Friday = Week 2
 *
 * Start Monday:
 * - Monday to Sunday = Week 1
 * - Next Monday = Week 2
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

function getMaybeTimestampYMD(value: any) {
  if (!value) return "";

  if (typeof value?.toDate === "function") {
    return dateToYMD(value.toDate());
  }

  if (value instanceof Date) {
    return dateToYMD(value);
  }

  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return dateToYMD(parsed);
  }

  return "";
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

  const startMode = resolveStartMode(input);
  const startDate = resolveStartDate(input);

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
  const currentStartYMD = getMaybeTimestampYMD(userData?.active_program_start_date);
  const desiredStartYMD = dateToYMD(startDate);

  if (
    skipIfAlreadyActive &&
    activeProgramId === resolvedProgramId &&
    activeAssignmentId &&
    currentAssignmentIsActive &&
    currentStartYMD === desiredStartYMD
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
      start_mode: String(userData?.active_program_start_mode || startMode) as ProgramStartMode,
      start_date: userData?.active_program_start_date?.toDate
        ? userData.active_program_start_date.toDate().toISOString()
        : startDate.toISOString(),
      end_date: userData?.active_program_end_date?.toDate
        ? userData.active_program_end_date.toDate().toISOString()
        : new Date().toISOString(),
    };
  }

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
      start_mode: startMode,
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
        program_start_mode: startMode,
        active_program_assignment_id: assignmentRef.id,
        active_program_id: resolvedProgramId,
        active_program_name: programName,
        active_program_status: "active",
        active_program_start_mode: startMode,
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
      const href = "/";
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
            start_mode: startMode,
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
    start_mode: startMode,
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
  };
}
