// pages/api/cron/weekly-booking-reminder.ts
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

function startOfUpcomingMondayUTC(from: Date): Date {
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);

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

function ymdUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatWeekRangeText(start: Date, end: Date): string {
  try {
    const startText = start.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

    const endText = end.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });

    return `${startText} – ${endText}`;
  } catch {
    return `${ymdUTC(start)} – ${ymdUTC(end)}`;
  }
}

function getHeader(req: NextApiRequest, name: string): string {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return String(raw[0] || "").trim();
  return String(raw || "").trim();
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
    const runKey = `weekly-booking-${TARGET_GYM_ID}-${targetWeekStart}`;

    const claimed = await claimRun(runKey, {
      type: "weekly_booking_reminder",
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

    const usersSnap = await firestore
      .collection("users")
      .where("gym_id", "==", TARGET_GYM_ID)
      .get();

    const emails = usersSnap.docs
      .map((doc) => String(doc.id || "").trim().toLowerCase())
      .filter(Boolean);

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

    const weekRangeText = formatWeekRangeText(nextMonday, nextSunday);
    const title = "Bookings now open for next week";
    const message = `Next week’s Iron Acre classes (${weekRangeText}) are ready to book. Tap to view the timetable and reserve your spots.`;
    const href = "/iron-acre";

    let succeeded = 0;
    let failed = 0;

    const chunks = chunkArray(emails, 20);

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk.map((email) =>
          notifyInAppAndPush(
            email,
            {
              title,
              message,
              href,
              source_key: "weekly_booking_reminder",
              source_event: "weekly_booking_reminder",
              meta: {
                gym_id: TARGET_GYM_ID,
                target_week_start: targetWeekStart,
                target_week_end: targetWeekEnd,
              },
            },
            {
              title,
              body: "Next week’s classes are ready to book.",
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
    console.error("[cron/weekly-booking-reminder]", err?.message || err);
    return res.status(500).json({ error: "Failed to send weekly booking reminder" });
  }
}
