// pages/api/cron/daily-habits-reminder.ts
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
      targetDate: string;
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
    const targetDate = ymdUTC(now);
    const runKey = `daily-habits-${TARGET_GYM_ID}-${targetDate}`;

    const claimed = await claimRun(runKey, {
      type: "daily_habits_reminder",
      gym_id: TARGET_GYM_ID,
      target_date: targetDate,
    });

    if (!claimed) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: "Already sent for this day",
        runKey,
        targetGymId: TARGET_GYM_ID,
        targetDate,
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

    const today = new Date(now);
    today.setUTCHours(12, 0, 0, 0);

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
        targetDate,
        attempted: 0,
        succeeded: 0,
        failed: 0,
      });
    }

    const activeToday = candidateAssignments.filter((a) => {
      const start = a.start_date;
      const end = a.end_date;
      if (!start || !end) return false;
      return start.getTime() <= today.getTime() && end.getTime() >= today.getTime();
    });

    if (!activeToday.length) {
      return res.status(200).json({
        ok: true,
        runKey,
        targetGymId: TARGET_GYM_ID,
        targetDate,
        attempted: 0,
        succeeded: 0,
        failed: 0,
      });
    }

    const uniqueEmails = Array.from(new Set(activeToday.map((a) => a.user_email)));
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
    for (const a of activeToday) {
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
        targetDate,
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

          const title = "Daily habits reminder";
          const message = `Log today’s habits for ${programName} and keep your momentum moving. Tap to open Iron Acre and tick them off.`;
          const href = "/iron-acre";

          return notifyInAppAndPush(
            email,
            {
              title,
              message,
              href,
              source_key: "daily_habits_reminder",
              source_event: "daily_habits_reminder",
              meta: {
                gym_id: TARGET_GYM_ID,
                target_date: targetDate,
                program_name: programName,
              },
            },
            {
              title,
              body: `Log today’s habits for ${programName}.`,
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
      targetDate,
      attempted: emails.length,
      succeeded,
      failed,
    });
  } catch (err: any) {
    console.error("[cron/daily-habits-reminder]", err?.message || err);
    return res.status(500).json({ error: "Failed to send daily habits reminder" });
  }
}
