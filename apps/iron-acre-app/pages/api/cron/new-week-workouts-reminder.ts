// pages/api/cron/new-week-workouts-reminder.ts
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
      targetGymId: string;
      targetWeekStart: string;
      targetWeekEnd: string;
      attempted: number;
      succeeded: number;
      failed: number;
    }
  | {
      error: string;
    };

const TARGET_GYM_ID = "g1";

function getHeader(req: NextApiRequest, name: string): string {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return String(raw[0] || "").trim();
  return String(raw || "").trim();
}

function ymdUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfUpcomingMondayUTC(from: Date): Date {
  const d = new Date(from);
  d.setUTCHours(12, 0, 0, 0);

  const day = d.getUTCDay(); // Sun=0, Mon=1, ... Sat=6
  const daysUntilNextMonday = ((8 - day) % 7) || 7;

  d.setUTCDate(d.getUTCDate() + daysUntilNextMonday);
  return d;
}

function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function toDateSafe(value: any): Date | null {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
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

    const nextMonday = startOfUpcomingMondayUTC(now);
    const nextSunday = addDaysUTC(nextMonday, 6);

    const targetWeekStart = ymdUTC(nextMonday);
    const targetWeekEnd = ymdUTC(nextSunday);
    const runKey = `new-week-workouts-${TARGET_GYM_ID}-${targetWeekStart}`;

    const claimed = await claimRun(runKey, {
      type: "new_week_workouts_reminder",
      gym_id: TARGET_GYM_ID,
      target_week_start: targetWeekStart,
      target_week_end: targetWeekEnd,
    });

    if (!claimed) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "Already sent for this target week",
        runKey,
        targetGymId: TARGET_GYM_ID,
        targetWeekStart,
        targetWeekEnd,
        attempted: 0,
        succeeded: 0,
        failed: 0,
      });
    }

    const assignmentsSnap = await firestore
      .collection("program_assignments")
      .where("gym_id", "==", TARGET_GYM_ID)
      .where("status", "==", "active")
      .get();

    const candidateAssignments = assignmentsSnap.docs
      .map((doc) => {
        const data = doc.data() as any;
        return {
          user_email: String(data?.user_email || "").trim().toLowerCase(),
          program_name: String(data?.program_name || "").trim() || "your program",
          start_date: toDateSafe(data?.start_date),
          end_date: toDateSafe(data?.end_date),
        };
      })
      .filter((x) => Boolean(x.user_email));

    if (!candidateAssignments.length) {
      return res.status(200).json({
        ok: true,
        runKey,
        targetGymId: TARGET_GYM_ID,
        targetWeekStart,
        targetWeekEnd,
        attempted: 0,
        succeeded: 0,
        failed: 0,
      });
    }

    // Only include assignments still active when the new target week begins
    const activeForTargetWeek = candidateAssignments.filter((a) => {
      const start = a.start_date;
      const end = a.end_date;
      if (!start || !end) return false;
      return start.getTime() <= nextMonday.getTime() && end.getTime() >= nextMonday.getTime();
    });

    if (!activeForTargetWeek.length) {
      return res.status(200).json({
        ok: true,
        runKey,
        targetGymId: TARGET_GYM_ID,
        targetWeekStart,
        targetWeekEnd,
        attempted: 0,
        succeeded: 0,
        failed: 0,
      });
    }

    // Cross-check user doc still belongs to the gym
    const uniqueEmails = Array.from(new Set(activeForTargetWeek.map((a) => a.user_email)));
    const userRefs = uniqueEmails.map((email) => firestore.collection("users").doc(email));
    const userDocs = uniqueEmails.length ? await firestore.getAll(...userRefs) : [];

    const validGymEmails = new Set<string>();
    for (const doc of userDocs) {
      if (!doc.exists) continue;
      const data = doc.data() as any;
      const gymId = String(data?.gym_id || "").trim();
      if (gymId === TARGET_GYM_ID) {
        validGymEmails.add(String(doc.id || "").trim().toLowerCase());
      }
    }

    const assignmentByEmail = new Map<string, { program_name: string }>();
    for (const a of activeForTargetWeek) {
      if (!validGymEmails.has(a.user_email)) continue;
      if (!assignmentByEmail.has(a.user_email)) {
        assignmentByEmail.set(a.user_email, { program_name: a.program_name });
      }
    }

    const emails = Array.from(assignmentByEmail.keys());

    if (!emails.length) {
      return res.status(200).json({
        ok: true,
        runKey,
        targetGymId: TARGET_GYM_ID,
        targetWeekStart,
        targetWeekEnd,
        attempted: 0,
        succeeded: 0,
        failed: 0,
      });
    }

    let succeeded = 0;
    let failed = 0;

    const chunks = chunkArray(emails, 20);

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map(async (email) => {
          const assignment = assignmentByEmail.get(email);
          const programName = assignment?.program_name || "your program";

          const title = "New week of training is ready";
          const message = `Your next week of ${programName} is ready. Tap to open Iron Acre, view your training, and get started strong.`;
          const href = "/iron-acre";

          return notifyInAppAndPush(
            email,
            {
              title,
              message,
              href,
              source_key: "new_week_workouts_reminder",
              source_event: "new_week_workouts_reminder",
              meta: {
                gym_id: TARGET_GYM_ID,
                target_week_start: targetWeekStart,
                target_week_end: targetWeekEnd,
                program_name: programName,
              },
            },
            {
              title,
              body: `Your next week of ${programName} is ready.`,
              url: href,
            }
          );
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          succeeded++;
        } else {
          failed++;
        }
      }
    }

    await firestore.collection("cron_runs").doc(runKey).set(
      {
        completed_at: Timestamp.now(),
        attempted: emails.length,
        succeeded,
        failed,
      },
      { merge: true }
    );

    return res.status(200).json({
      ok: true,
      runKey,
      targetGymId: TARGET_GYM_ID,
      targetWeekStart,
      targetWeekEnd,
      attempted: emails.length,
      succeeded,
      failed,
    });
  } catch (err: any) {
    console.error("[cron/new-week-workouts-reminder]", err?.message || err);
    return res.status(500).json({ error: "Failed to send new week workouts reminder" });
  }
}
