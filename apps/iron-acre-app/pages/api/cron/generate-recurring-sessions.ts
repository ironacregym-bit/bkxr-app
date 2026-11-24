// pages/api/cron/generate-recurring-sessions.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Timestamp } from "@google-cloud/firestore";
import firestore from "../../../lib/firestoreClient";
import { notifyInAppAndPush } from "../../../lib/notify";
import { sendMail } from "../../../lib/email";

type Resp =
  | {
      ok: true;
      skipped?: boolean;
      reason?: string;
      runKey: string;
      targetWeekStart: string;
      targetWeekEnd: string;
      targetMonthLabel: string;
      created: number;
      sessionIds: string[];
      notifiedUsers: number;
      notificationFailures: number;
      emailedUsers: number;
      emailFailures: number;
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

function startOfMonthUTCFromYYYYMM(value: string): Date | null {
  const trimmed = String(value || "").trim();

  if (!/^\d{4}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const [yearRaw, monthRaw] = trimmed.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }

  if (month < 1 || month > 12) {
    return null;
  }

  const d = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  return isNaN(d.getTime()) ? null : d;
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
  const [hours, minutes] = String(hhmm || "")
    .split(":")
    .map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  const localDate = new Date(`${dateYMD}T${hhmm}:00`);

  const londonString = localDate.toLocaleString("en-US", {
    timeZone: "Europe/London",
  });

  const londonDate = new Date(londonString);

  const offsetMs = localDate.getTime() - londonDate.getTime();

  return new Date(localDate.getTime() + offsetMs);
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

function getUserGymId(user: any): string {
  return String(user?.gym_id || user?.gymId || "").trim();
}

function getUserEmail(docId: string, user: any): string {
  const emailFromDoc = String(docId || "").trim().toLowerCase();
  const emailFromData = String(user?.email || user?.user_email || "").trim().toLowerCase();

  if (emailFromDoc.includes("@")) return emailFromDoc;
  if (emailFromData.includes("@")) return emailFromData;

  return "";
}

function shouldNotifyUserForGym(user: any, targetGymId: string): boolean {
  const userGymId = getUserGymId(user);

  if (!targetGymId || userGymId !== targetGymId) {
    return false;
  }

  if (
    user?.deleted === true ||
    user?.disabled === true ||
    user?.archived === true ||
    user?.is_deleted === true ||
    user?.isDeleted === true ||
    user?.is_disabled === true ||
    user?.isDisabled === true
  ) {
    return false;
  }

  const explicitGymMemberFlags = [
    user?.is_gym_member,
    user?.isGymMember,
    user?.gym_member,
    user?.gymMember,
    user?.member,
    user?.is_member,
    user?.isMember,
  ];

  if (explicitGymMemberFlags.some((value) => value === false)) {
    return false;
  }

  const rawStatus = String(
    user?.membership_status ||
      user?.membershipStatus ||
      user?.member_status ||
      user?.memberStatus ||
      user?.subscription_status ||
      user?.subscriptionStatus ||
      user?.stripe_subscription_status ||
      user?.stripeSubscriptionStatus ||
      user?.status ||
      ""
  )
    .trim()
    .toLowerCase();

  const blockedStatuses = new Set([
    "inactive",
    "cancelled",
    "canceled",
    "expired",
    "deleted",
    "disabled",
    "archived",
    "paused",
    "unpaid",
    "past_due",
    "past due",
    "incomplete",
    "incomplete_expired",
  ]);

  if (rawStatus && blockedStatuses.has(rawStatus)) {
    return false;
  }

  return true;
}

function buildMonthlySessionsEmailHtml(params: {
  gymName: string;
  monthText: string;
  createdCount: number;
}) {
  const { gymName, monthText, createdCount } = params;
  const classText = createdCount === 1 ? "1 class is" : `${createdCount} classes are`;

  return `
    <div style="font-family: Arial, sans-serif; color: #111111; line-height: 1.6; max-width: 620px; margin: 0 auto;">
      <h1 style="margin: 0 0 16px; font-size: 28px; line-height: 1.2;">
        ${monthText} classes are now live
      </h1>

      <p style="margin: 0 0 16px;">
        ${classText} now available to book at ${gymName}.
      </p>

      <p style="margin: 0 0 16px;">
        View the Iron Acre timetable online and reserve your place before sessions fill up.
      </p>
      
      <p style="margin: 24px 0;">
        <a
          href="https://ironacregym.co.uk/schedule"
          style="
            background:#d97706;
            color:#ffffff;
            padding:14px 22px;
            border-radius:8px;
            text-decoration:none;
            display:inline-block;
            font-weight:700;
          "
        >
          View Timetable & Book Sessions
        </a>
      </p>

      <p style="margin: 0 0 16px;">
        Class numbers are limited, so booking ahead is the best way to make sure you get the sessions you want.
      </p>

      <p style="margin: 24px 0 0;">
        See you in the yard,<br />
        <strong>Iron Acre Gym</strong>
      </p>
    </div>
  `;
}

function buildMonthlySessionsEmailText(params: {
  gymName: string;
  monthText: string;
  createdCount: number;
}) {
  const { gymName, monthText, createdCount } = params;
  const classText = createdCount === 1 ? "1 class is" : `${createdCount} classes are`;

  return `${monthText} classes are now live

${classText} now available to book at ${gymName}.

View the timetable and book your sessions here:

https://ironacregym.co.uk/schedule

Class numbers are limited, so booking ahead is the best way to make sure you get the sessions you want.

See you in the yard,
Iron Acre Gym`;
}

async function getGymMemberEmails(gymId: string): Promise<string[]> {
  const usersSnap = await firestore.collection("users").get();

  const emails = usersSnap.docs
    .map((doc) => {
      const data = doc.data() as any;

      if (!shouldNotifyUserForGym(data, gymId)) {
        return "";
      }

      return getUserEmail(doc.id, data);
    })
    .filter(Boolean);

  return Array.from(new Set(emails));
}

async function notifyGymMembersOfNewMonth(params: {
  gymId: string;
  gymName: string;
  targetWeekStart: string;
  targetWeekEnd: string;
  targetMonthLabel: string;
  createdCount: number;
  sessionIds: string[];
}) {
  const {
    gymId,
    gymName,
    targetWeekStart,
    targetWeekEnd,
    targetMonthLabel,
    createdCount,
    sessionIds,
  } = params;

  const targetEmails = await getGymMemberEmails(gymId);

  if (!targetEmails.length) {
    return {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      emailAttempted: 0,
      emailSucceeded: 0,
      emailFailed: 0,
    };
  }

  const title = `${targetMonthLabel} classes are now live`;
  const message =
    createdCount === 1
      ? `${gymName} has opened bookings for ${targetMonthLabel}. Tap to view the schedule and secure your place.`
      : `${gymName} has opened bookings for ${targetMonthLabel}. ${createdCount} classes are now available to book. Tap to view the schedule and secure your places.`;

  const href = "https://ironacregym.co.uk/schedule";

  let succeeded = 0;
  let failed = 0;
  let emailSucceeded = 0;
  let emailFailed = 0;

  const chunks = chunkArray(targetEmails, 20);

  for (const chunk of chunks) {
    const notificationResults = await Promise.allSettled(
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
              target_month_label: targetMonthLabel,
              created_count: createdCount,
              session_ids: sessionIds,
            },
          },
          {
            title,
          body:
            createdCount === 1
              ? "A new class is now available. Tap to view the timetable and book your place."
              : `${targetMonthLabel} sessions are now available. Tap to view the timetable and book your place.`,
            url: href,
          }
        )
      )
    );

    for (const result of notificationResults) {
      if (result.status === "fulfilled") {
        succeeded++;
      } else {
        failed++;
      }
    }

    const emailResults = await Promise.allSettled(
      chunk.map((email) =>
        sendMail({
          to: email,
          subject: `${targetMonthLabel} classes are now live`,
          html: buildMonthlySessionsEmailHtml({
            gymName,
            monthText: targetMonthLabel,
            createdCount,
          }),
          text: buildMonthlySessionsEmailText({
            gymName,
            monthText: targetMonthLabel,
            createdCount,
          }),
        })
      )
    );

    for (const result of emailResults) {
      if (result.status === "fulfilled") {
        emailSucceeded++;
      } else {
        emailFailed++;
      }
    }
  }

  return {
    attempted: targetEmails.length,
    succeeded,
    failed,
    emailAttempted: targetEmails.length,
    emailSucceeded,
    emailFailed,
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
    const body = (req.body || {}) as { target_month?: string };

    const manualTargetMonth = String(body.target_month || "").trim();
    const manualTargetMonthStartDate = manualTargetMonth
      ? startOfMonthUTCFromYYYYMM(manualTargetMonth)
      : null;

    if (manualTargetMonth && !manualTargetMonthStartDate) {
      return res.status(400).json({
        error: "Invalid target_month. Use YYYY-MM, for example 2026-08.",
      });
    }

    const targetMonthStartDate = manualTargetMonthStartDate || startOfNextMonthUTC(now);
    const targetMonthEndDate = endOfMonthUTC(targetMonthStartDate);
    const targetMonthLabel = formatMonthText(targetMonthStartDate);

    const targetWeekStart = ymdUTC(targetMonthStartDate);
    const targetWeekEnd = ymdUTC(targetMonthEndDate);

    const runKey = manualTargetMonthStartDate
      ? `generate-recurring-sessions-manual-${targetWeekStart}`
      : `generate-recurring-sessions-${targetWeekStart}`;

    const claimed = await claimRun(runKey, {
      type: "generate_recurring_sessions",
      generation_scope: manualTargetMonthStartDate ? "manual_monthly" : "monthly",
      target_week_start: targetWeekStart,
      target_week_end: targetWeekEnd,
      target_month_start: targetWeekStart,
      target_month_end: targetWeekEnd,
      target_month_label: targetMonthLabel,
      requested_target_month: manualTargetMonth || null,
    });

    if (!claimed) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: manualTargetMonthStartDate
          ? "Already generated for this manual target month"
          : "Already generated for this target month",
        runKey,
        targetWeekStart,
        targetWeekEnd,
        targetMonthLabel,
        created: 0,
        sessionIds: [],
        notifiedUsers: 0,
        notificationFailures: 0,
        emailedUsers: 0,
        emailFailures: 0,
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
          emailed_users: 0,
          email_failures: 0,
        },
        { merge: true }
      );

      return res.status(200).json({
        ok: true,
        runKey,
        targetWeekStart,
        targetWeekEnd,
        targetMonthLabel,
        created: 0,
        sessionIds: [],
        notifiedUsers: 0,
        notificationFailures: 0,
        emailedUsers: 0,
        emailFailures: 0,
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
          generation_scope: manualTargetMonthStartDate ? "manual_monthly" : "monthly",
          generated_for_month_start: targetWeekStart,
          generated_for_month_end: targetWeekEnd,
          generated_for_month_label: targetMonthLabel,
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
    let emailedUsers = 0;
    let emailFailures = 0;

    for (const [gymId, gymMeta] of createdByGym.entries()) {

      const notificationSummary = await notifyGymMembersOfNewMonth({
        gymId,
        gymName: gymMeta.gymName,
        targetWeekStart,
        targetWeekEnd,
        targetMonthLabel,
        createdCount: gymMeta.sessionIds.length,
        sessionIds: gymMeta.sessionIds,
      });

      notifiedUsers += notificationSummary.succeeded;
      notificationFailures += notificationSummary.failed;
      emailedUsers += notificationSummary.emailSucceeded;
      emailFailures += notificationSummary.emailFailed;
    }

    await firestore.collection("cron_runs").doc(runKey).set(
      {
        completed_at: Timestamp.now(),
        created: createdSessionIds.length,
        session_ids: createdSessionIds,
        notified_users: notifiedUsers,
        notification_failures: notificationFailures,
        emailed_users: emailedUsers,
        email_failures: emailFailures,
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      runKey,
      targetWeekStart,
      targetWeekEnd,
      targetMonthLabel,
      created: createdSessionIds.length,
      sessionIds: createdSessionIds,
      notifiedUsers,
      notificationFailures,
      emailedUsers,
      emailFailures,
    });
  } catch (err: any) {
    console.error("[cron/generate-recurring-sessions]", err?.message || err);
    return res.status(500).json({ error: "Failed to generate recurring sessions" });
  }
}
