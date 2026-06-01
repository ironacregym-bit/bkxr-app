// pages/api/admin/sessions/recurring-create.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Timestamp } from "@google-cloud/firestore";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";
import { notifyInAppAndPush } from "../../../../lib/notify";

type Body = {
  class_id?: string;
  gym_id?: string;
  coach_name?: string;
  weekdays?: number[];
  start_date?: string;
  end_date?: string;
  start_time_hhmm?: string;
  end_time_hhmm?: string;
  price?: number;
  max_attendance?: number;
  notify_members?: boolean;
};

type Resp =
  | {
      ok: true;
      created: number;
      sessionIds: string[];
      notifiedUsers: number;
      notificationFailures: number;
    }
  | { error: string };

function parseYMD(value: string): Date | null {
  const [year, month, day] = value.split("-").map((x) => Number(x));

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

function parseDateTime(dateYMD: string, hhmm: string): Date | null {
  const base = parseYMD(dateYMD);
  if (!base) return null;

  const [hours, minutes] = String(hhmm || "")
    .split(":")
    .map((x) => Number(x));

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  const d = new Date(base);
  d.setHours(hours, minutes, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateRange(startDate: Date, endDate: Date): string {
  try {
    const start = startDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });

    const end = endDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return `${start} → ${end}`;
  } catch {
    return `${startDate.toISOString()} → ${endDate.toISOString()}`;
  }
}

function buildRecurringDates(startDate: Date, endDate: Date, weekdays: number[]): Date[] {
  const out: Date[] = [];
  const allowed = new Set(weekdays);

  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (cursor <= end) {
    if (allowed.has(cursor.getDay())) {
      out.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return out;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function isValidWeekday(n: unknown): n is number {
  return Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 6;
}

async function notifyGymMembersOfRecurringSessions(params: {
  gymId: string;
  gymName: string;
  className: string;
  startDate: Date;
  endDate: Date;
  createdCount: number;
  sessionIds: string[];
}) {
  const { gymId, gymName, className, startDate, endDate, createdCount, sessionIds } = params;

  const usersSnap = await firestore.collection("users").get();

  const targetEmails = usersSnap.docs
    .filter((doc) => {
      const data = doc.data() as any;
      return String(data?.gym_id || "").trim() === gymId;
    })
    .map((doc) => String(doc.id || "").trim().toLowerCase())
    .filter(Boolean);

  if (!targetEmails.length) {
    return { attempted: 0, succeeded: 0, failed: 0 };
  }

  const title = "New classes added";
  const rangeText = formatDateRange(startDate, endDate);

  const message =
    createdCount === 1
      ? `${className} has been added to the ${gymName} timetable. Tap to view the updated schedule.`
      : `${createdCount} ${className} sessions have been added to the ${gymName} timetable for ${rangeText}. Tap to view the updated schedule.`;

  const href = "/iron-acre";

  let succeeded = 0;
  let failed = 0;

  const chunks = chunkArray(targetEmails, 20);

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map((email) =>
        notifyInAppAndPush(
          email,
          {
            title,
            message,
            href,
            source_key: "session_recurring",
            source_event: "created",
            meta: {
              gym_id: gymId,
              gym_name: gymName,
              class_name: className,
              created_count: createdCount,
              session_ids: sessionIds,
              start_date: startDate.toISOString(),
              end_date: endDate.toISOString(),
            },
          },
          {
            title,
            body:
              createdCount === 1
                ? `${className} added to the timetable`
                : `${createdCount} new ${className} sessions added`,
            url: href,
          }
        )
      )
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        succeeded++;
      } else {
        failed++;
      }
    }
  }

  return {
    attempted: targetEmails.length,
    succeeded,
    failed,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authSession = await getServerSession(req, res, authOptions);
    const role = (authSession?.user as any)?.role || "user";

    if (!authSession?.user?.email || (role !== "admin" && role !== "gym")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = (req.body || {}) as Body;

    const classId = String(body.class_id || "").trim();
    const gymId = String(body.gym_id || "").trim();
    const coachName = String(body.coach_name || "").trim();
    const weekdays = Array.isArray(body.weekdays) ? body.weekdays.filter(isValidWeekday) : [];
    const startDateRaw = String(body.start_date || "").trim();
    const endDateRaw = String(body.end_date || "").trim();
    const startHHMM = String(body.start_time_hhmm || "").trim();
    const endHHMM = String(body.end_time_hhmm || "").trim();
    const price = Number(body.price || 0);
    const maxAttendance = Number(body.max_attendance || 0);
    const notifyMembers = Boolean(body.notify_members);

    if (!classId) {
      return res.status(400).json({ error: "Class is required" });
    }

    if (!gymId) {
      return res.status(400).json({ error: "Gym is required" });
    }

    if (!startDateRaw) {
      return res.status(400).json({ error: "Start date is required" });
    }

    if (!endDateRaw) {
      return res.status(400).json({ error: "End date is required" });
    }

    if (!startHHMM) {
      return res.status(400).json({ error: "Start time is required" });
    }

    if (!endHHMM) {
      return res.status(400).json({ error: "End time is required" });
    }

    if (!weekdays.length) {
      return res.status(400).json({ error: "At least one weekday is required" });
    }

    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: "Price must be 0 or greater" });
    }

    if (!Number.isFinite(maxAttendance) || maxAttendance < 1) {
      return res.status(400).json({ error: "Max attendance must be at least 1" });
    }

    const startDate = parseYMD(startDateRaw);
    const endDate = parseYMD(endDateRaw);

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Invalid start or end date" });
    }

    if (endDate < startDate) {
      return res.status(400).json({ error: "End date must be on or after start date" });
    }

    const dates = buildRecurringDates(startDate, endDate, weekdays);

    if (!dates.length) {
      return res.status(400).json({
        error: "No sessions would be created for the selected date range and weekdays",
      });
    }

    if (dates.length > 200) {
      return res.status(400).json({
        error: "Too many sessions requested in one go. Please reduce the date range.",
      });
    }

    const [gymDoc, classDoc] = await Promise.all([
      firestore.collection("gyms").doc(gymId).get(),
      firestore.collection("gymClasses").doc(classId).get(),
    ]);

    if (!gymDoc.exists) {
      return res.status(400).json({ error: "Selected gym does not exist" });
    }

    if (!classDoc.exists) {
      return res.status(400).json({ error: "Selected class does not exist" });
    }

    const gymData = gymDoc.data() as any;
    const classData = classDoc.data() as any;

    const gymName = String(gymData?.name || gymId);
    const className = String(classData?.name || classData?.title || classId);

    const docsToCreate = dates.map((dateOnly) => {
      const y = dateOnly.getFullYear();
      const m = String(dateOnly.getMonth() + 1).padStart(2, "0");
      const d = String(dateOnly.getDate()).padStart(2, "0");
      const ymd = `${y}-${m}-${d}`;

      const startDateTime = parseDateTime(ymd, startHHMM);
      const endDateTime = parseDateTime(ymd, endHHMM);

      return {
        ymd,
        startDateTime,
        endDateTime,
      };
    });

    if (docsToCreate.some((x) => !x.startDateTime || !x.endDateTime)) {
      return res.status(400).json({ error: "Invalid generated session date/time" });
    }

    if (docsToCreate.some((x) => (x.endDateTime as Date) <= (x.startDateTime as Date))) {
      return res.status(400).json({ error: "End time must be after start time" });
    }

    const now = Timestamp.now();
    const createdBy = String(authSession.user.email || "").trim().toLowerCase();
    const sessionIds: string[] = [];

    const writeChunks = chunkArray(docsToCreate, 200);

    for (const writeChunk of writeChunks) {
      const batch = firestore.batch();

      for (const item of writeChunk) {
        const ref = firestore.collection("session").doc();
        sessionIds.push(ref.id);

        batch.set(ref, {
          id: ref.id,
          class_id: classId,
          gym_id: gymId,
          start_time: Timestamp.fromDate(item.startDateTime as Date),
          end_time: Timestamp.fromDate(item.endDateTime as Date),
          coach_name: coachName || null,
          price,
          max_attendance: Math.floor(maxAttendance),
          current_attendance: 0,
          notify_members: notifyMembers,
          recurring: true,
          recurring_pattern: {
            weekdays,
            start_date: startDateRaw,
            end_date: endDateRaw,
            start_time_hhmm: startHHMM,
            end_time_hhmm: endHHMM,
          },
          created_at: now,
          updated_at: now,
          created_by: createdBy,
        });
      }

      await batch.commit();
    }

    let notificationSummary = {
      attempted: 0,
      succeeded: 0,
      failed: 0,
    };

    if (notifyMembers) {
      notificationSummary = await notifyGymMembersOfRecurringSessions({
        gymId,
        gymName,
        className,
        startDate,
        endDate,
        createdCount: sessionIds.length,
        sessionIds,
      });
    }

    return res.status(200).json({
      ok: true,
      created: sessionIds.length,
      sessionIds,
      notifiedUsers: notificationSummary.succeeded,
      notificationFailures: notificationSummary.failed,
    });
  } catch (err: any) {
    console.error("[admin/sessions/recurring-create]", err?.message || err);
    return res.status(500).json({ error: "Failed to create recurring sessions" });
  }
}
