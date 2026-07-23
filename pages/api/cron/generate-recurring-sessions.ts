// pages/api/cron/generate-recurring-sessions.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Timestamp } from "@google-cloud/firestore";
import firestore from "../../../lib/firestoreClient";
import { notifyInAppAndPush } from "../../../lib/notify";

type Resp =
  | {
      ok: true;
      skipped?: boolean;
      reason?: string;
      runKey: string;
      targetWeekStart: string;
      targetWeekEnd: string;
      created: number;
      sessionIds: string[];
      notifiedUsers: number;
      notificationFailures: number;
    }
  | {
      error: string;
    };

type RecurringTimetableItem = {
  id: string;
  active?: boolean;
  class_id?: string | null;
  class_name?: string | null;
  gym_id?: string | null;
  gym_name?: string | null;
  coach_name?: string | null;
  weekdays?: number[];
  start_time_hhmm?: string | null;
  end_time_hhmm?: string | null;
  price?: number | null;
  drop_in_price?: number | null;
  max_attendance?: number | null;
  notify_members?: boolean;
  effective_from?: string | null;
  effective_to?: string | null;
};

function getHeader(req: NextApiRequest, name: string): string {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return String(raw[0] || "").trim();
  return String(raw || "").trim();
}

function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function startOfNextMonthUTC(from: Date): Date {
  return new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth() + 1,
      1,
      0,
      0,
      0,
      0
    )
  );
}

function endOfMonthUTC(monthStart: Date): Date {
  return new Date(
    Date.UTC(
      monthStart.getUTCFullYear(),
      monthStart.getUTCMonth() + 1,
      0,
      23,
      59,
      59,
      999
    )
  );
}

function ymdUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseYmdUtc(value: string | null | undefined): Date | null {
  const v = String(value || "").trim();
  if (!v) return null;

  const [year, month, day] = v.split("-").map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return isNaN(d.getTime()) ? null : d;
}

function parseDateTimeUTC(dateYMD: string, hhmm: string): Date | null {
  const date = parseYmdUtc(dateYMD);
  if (!date) return null;

  const [hours, minutes] = String(hhmm || "")
    .split(":")
    .map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  const d = new Date(date);
  d.setUTCHours(hours, minutes, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

function weekdayFromYmdUTC(dateYMD: string): number {
  const d = parseYmdUtc(dateYMD);
  return d ? d.getUTCDay() : -1;
}

function formatMonthText(date: Date): string {
  try {
    return date.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return ymdUTC(date).slice(0, 7);
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function claimRun(runKey: string, meta: Record<string, any>) {
  const ref = firestore.collection("cron_runs").doc(runKey);

  let created = false;

  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return;

    tx.set(ref, {
      ...meta,
      created_at: Timestamp.now(),
    });

    created = true;
  });

  return created;
}

function isActiveRecurringItem(item: RecurringTimetableItem) {
  return item.active !== false;
}

function matchesEffectiveWindow(item: RecurringTimetableItem, dateYMD: string) {
  const from = String(item.effective_from || "").trim();
  const to = String(item.effective_to || "").trim();

  if (from && dateYMD < from) return false;
  if (to && dateYMD > to) return false;

  return true;
}

function shouldNotifyUserForGym(user: any, targetGymId: string): boolean {
  const userGymId = String(user?.gym_id || "").trim();
  return Boolean(userGymId) && userGymId === targetGymId;
}

async function notifyGymMembersOfNewWeek(params: {
  gymId: string;
  gymName: string;
  targetWeekStart: string;
  targetWeekEnd: string;
  createdCount: number;
  sessionIds: string[];
}) {
  const { gymId, gymName, targetWeekStart, targetWeekEnd, createdCount, sessionIds } = params;

  const usersSnap = await firestore.collection("users").get();

  const targetEmails = usersSnap.docs
    .filter((doc) => shouldNotifyUserForGym(doc.data(), gymId))
    .map((doc) => String(doc.id || "").trim().toLowerCase())
    .filter(Boolean);

  if (!targetEmails.length) {
    return { attempted: 0, succeeded: 0, failed: 0 };
  }

  const monthStart = parseYmdUtc(targetWeekStart) || new Date();
  const monthText = formatMonthText(monthStart);

  const title = `${monthText} classes are now live`;
  const message =
    createdCount === 1
      ? `${gymName} has opened bookings for ${monthText}. Tap to view the schedule and secure your place.`
      : `${gymName} has opened bookings for ${monthText}. ${createdCount} classes are now available to book. Tap to view the schedule and secure your places.`;

  const href = "/schedule";

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
            source_key: "recurring_sessions_generated",
            source_event: "recurring_sessions_generated",
            meta: {
              gym_id: gymId,
              gym_name: gymName,
              target_week_start: targetWeekStart,
              target_week_end: targetWeekEnd,
              target_month_start: targetWeekStart,
              target_month_end: targetWeekEnd,
              target_month_label: monthText,
              created_count: createdCount,
              session_ids: sessionIds,
            },
          },
          {
            title,
            body:
              createdCount === 1
                ? "A new class is now open to book."
                : `${monthText} timetable is ready to book.`,
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

  const cronKey = getHeader(req, "x-cron-key");
  const expected = String(process.env.CRON_KEY || "").trim();

  if (!expected || cronKey !== expected) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const now = new Date();

    // Monthly run => generate every recurring session for the next calendar month.
    // Example: 1 August generates all September sessions.
    const targetMonthStartDate = startOfNextMonthUTC(now);
    const targetMonthEndDate = endOfMonthUTC(targetMonthStartDate);

    // Kept as targetWeekStart / targetWeekEnd to avoid changing existing response shape,
    // existing cron_run fields, and downstream notification metadata.
    const targetWeekStart = ymdUTC(targetMonthStartDate);
    const targetWeekEnd = ymdUTC(targetMonthEndDate);
    const runKey = `generate-recurring-sessions-${targetWeekStart}`;

    const claimed = await claimRun(runKey, {
      type: "generate_recurring_sessions",
      generation_scope: "monthly",
      target_week_start: targetWeekStart,
      target_week_end: targetWeekEnd,
      target_month_start: targetWeekStart,
      target_month_end: targetWeekEnd,
      target_month_label: formatMonthText(targetMonthStartDate),
    });

    if (!claimed) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "Already generated for this target month",
        runKey,
        targetWeekStart,
        targetWeekEnd,
        created: 0,
        sessionIds: [],
        notifiedUsers: 0,
        notificationFailures: 0,
      });
    }

    const recurringSnap = await firestore
      .collection("recurring_timetables")
      .where("active", "==", true)
      .get();

    const recurringItems = recurringSnap.docs.map((doc) => {
      const data = doc.data() as RecurringTimetableItem;
      return {
        ...data,
        id: doc.id,
      };
    });

    const targetDates: string[] = [];
    let currentDate = new Date(targetMonthStartDate);

    while (currentDate <= targetMonthEndDate) {
      targetDates.push(ymdUTC(currentDate));
      currentDate = addDaysUTC(currentDate, 1);
    }

    const candidates = recurringItems.flatMap((item) => {
      if (!isActiveRecurringItem(item)) return [];

      const weekdays = Array.isArray(item.weekdays) ? item.weekdays : [];
      if (!weekdays.length) return [];

      return targetDates
        .filter((dateYMD) => {
          const weekday = weekdayFromYmdUTC(dateYMD);
          if (!weekdays.includes(weekday)) return false;
          if (!matchesEffectiveWindow(item, dateYMD)) return false;
          return true;
        })
        .map((dateYMD) => {
          const startDateTime = parseDateTimeUTC(dateYMD, String(item.start_time_hhmm || ""));
          const endDateTime = parseDateTimeUTC(dateYMD, String(item.end_time_hhmm || ""));

          return {
            recurringId: item.id,
            dateYMD,
            refId: `${item.id}_${dateYMD}`,
            item,
            startDateTime,
            endDateTime,
          };
        })
        .filter((x) => x.startDateTime && x.endDateTime);
    });

    if (!candidates.length) {
      await firestore.collection("cron_runs").doc(runKey).set(
        {
          completed_at: Timestamp.now(),
          created: 0,
          session_ids: [],
          notified_users: 0,
          notification_failures: 0,
        },
        { merge: true }
      );

      return res.status(200).json({
        ok: true,
        runKey,
        targetWeekStart,
        targetWeekEnd,
        created: 0,
        sessionIds: [],
        notifiedUsers: 0,
        notificationFailures: 0,
      });
    }

    const sessionRefs = candidates.map((c) => firestore.collection("session").doc(c.refId));
    const existingSnaps = await firestore.getAll(...sessionRefs);

    const existingIdSet = new Set(
      existingSnaps.filter((snap) => snap.exists).map((snap) => snap.id)
    );

    const toCreate = candidates.filter((c) => !existingIdSet.has(c.refId));

    const nowTs = Timestamp.now();
    const createdBy = "system";
    const createdSessionIds: string[] = [];

    const writeChunks = chunkArray(toCreate, 200);

    for (const writeChunk of writeChunks) {
      const batch = firestore.batch();

      for (const candidate of writeChunk) {
        const item = candidate.item;
        const ref = firestore.collection("session").doc(candidate.refId);

        createdSessionIds.push(ref.id);

        batch.set(ref, {
          id: ref.id,
          class_id: String(item.class_id || "").trim() || null,
          class_name: String(item.class_name || item.class_id || "Class").trim(),
          gym_id: String(item.gym_id || "").trim() || null,
          gym_name: String(item.gym_name || item.gym_id || "Gym").trim(),
          coach_name: String(item.coach_name || "").trim() || null,
          start_time: Timestamp.fromDate(candidate.startDateTime as Date),
          end_time: Timestamp.fromDate(candidate.endDateTime as Date),
          price: Number(item.price || 9),
          drop_in_price: Number(item.drop_in_price || 12),
          max_attendance: Math.floor(Number(item.max_attendance || 1)),
          current_attendance: 0,
          notify_members: Boolean(item.notify_members),
          recurring: true,
          recurring_source_id: candidate.recurringId,
          recurring_session_date: candidate.dateYMD,
          recurring_pattern: {
            weekdays: Array.isArray(item.weekdays) ? item.weekdays : [],
            start_time_hhmm: String(item.start_time_hhmm || ""),
            end_time_hhmm: String(item.end_time_hhmm || ""),
            effective_from: String(item.effective_from || "").trim() || null,
            effective_to: String(item.effective_to || "").trim() || null,
          },
          source: "recurring_generator",
          generation_scope: "monthly",
          generated_for_month_start: targetWeekStart,
          generated_for_month_end: targetWeekEnd,
          generated_for_month_label: formatMonthText(targetMonthStartDate),
          cancelled: false,
          cancelled_at: null,
          cancelled_by: null,
          created_at: nowTs,
          updated_at: nowTs,
          created_by: createdBy,
        });
      }

      await batch.commit();
    }

    const createdByGym = new Map<
      string,
      { gymName: string; sessionIds: string[]; notifyMembersEnabled: boolean }
    >();

    for (const candidate of toCreate) {
      const gymId = String(candidate.item.gym_id || "").trim();
      const gymName = String(candidate.item.gym_name || candidate.item.gym_id || "Gym").trim();
      const notifyMembersEnabled = Boolean(candidate.item.notify_members);

      if (!gymId) continue;

      const existing = createdByGym.get(gymId) || {
        gymName,
        sessionIds: [],
        notifyMembersEnabled: false,
      };

      existing.sessionIds.push(candidate.refId);
      existing.notifyMembersEnabled = existing.notifyMembersEnabled || notifyMembersEnabled;
      createdByGym.set(gymId, existing);
    }

    let notifiedUsers = 0;
    let notificationFailures = 0;

    for (const [gymId, gymMeta] of createdByGym.entries()) {
      if (!gymMeta.notifyMembersEnabled) continue;

      const notificationSummary = await notifyGymMembersOfNewWeek({
        gymId,
        gymName: gymMeta.gymName,
        targetWeekStart,
        targetWeekEnd,
        createdCount: gymMeta.sessionIds.length,
        sessionIds: gymMeta.sessionIds,
      });

      notifiedUsers += notificationSummary.succeeded;
      notificationFailures += notificationSummary.failed;
    }

    await firestore.collection("cron_runs").doc(runKey).set(
      {
        completed_at: Timestamp.now(),
        created: createdSessionIds.length,
        session_ids: createdSessionIds,
        notified_users: notifiedUsers,
        notification_failures: notificationFailures,
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      runKey,
      targetWeekStart,
      targetWeekEnd,
      created: createdSessionIds.length,
      sessionIds: createdSessionIds,
      notifiedUsers,
      notificationFailures,
    });
  } catch (err: any) {
    console.error("[cron/generate-recurring-sessions]", err?.message || err);
    return res.status(500).json({ error: "Failed to generate recurring sessions" });
  }
}
