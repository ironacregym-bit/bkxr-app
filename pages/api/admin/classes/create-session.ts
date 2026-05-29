// pages/api/admin/classes/create-session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { Timestamp } from "@google-cloud/firestore";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";
import { notifyInAppAndPush } from "../../../../lib/notify";

type Body = {
  class_id?: string;
  gym_id?: string;
  date?: string;
  start_time_hhmm?: string;
  end_time_hhmm?: string;
  coach_name?: string;
  price?: number;
  max_attendance?: number;
  notify_members?: boolean;
};

function parseDateTime(dateYMD: string, hhmm: string): Date | null {
  const [year, month, day] = dateYMD.split("-").map((x) => Number(x));
  const [hours, minutes] = hhmm.split(":").map((x) => Number(x));

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return null;
  }

  const value = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return isNaN(value.getTime()) ? null : value;
}

function formatSessionDateTime(startDate: Date, endDate: Date): string {
  try {
    const datePart = startDate.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    const startPart = startDate.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const endPart = endDate.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    return `${datePart} • ${startPart}-${endPart}`;
  } catch {
    return `${startDate.toISOString()} - ${endDate.toISOString()}`;
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function notifyUsersOfNewSession(params: {
  userEmails: string[];
  sessionId: string;
  className: string;
  gymName: string;
  startDate: Date;
  endDate: Date;
}) {
  const { userEmails, sessionId, className, gymName, startDate, endDate } = params;

  if (!userEmails.length) {
    return { attempted: 0, succeeded: 0, failed: 0 };
  }

  const whenText = formatSessionDateTime(startDate, endDate);
  const title = "New class added";
  const message = `${className} has been added at ${gymName} on ${whenText}. Tap to view the latest schedule.`;
  const href = "/iron-acre";

  let succeeded = 0;
  let failed = 0;

  const chunks = chunkArray(userEmails, 20);

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map((email) =>
        notifyInAppAndPush(
          email,
          {
            title,
            message,
            href,
            source_key: "session",
            source_event: "created",
            meta: {
              session_id: sessionId,
              class_name: className,
              gym_name: gymName,
              start_time: startDate.toISOString(),
              end_time: endDate.toISOString(),
            },
          },
          {
            title,
            body: `${className} • ${whenText}`,
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
    attempted: userEmails.length,
    succeeded,
    failed,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const role = (session?.user as any)?.role || "user";

    if (!session?.user?.email || (role !== "admin" && role !== "gym")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = (req.body || {}) as Body;

    const classId = String(body.class_id || "").trim();
    const gymId = String(body.gym_id || "").trim();
    const date = String(body.date || "").trim();
    const startHHMM = String(body.start_time_hhmm || "").trim();
    const endHHMM = String(body.end_time_hhmm || "").trim();
    const coachName = String(body.coach_name || "").trim();
    const price = Number(body.price || 0);
    const maxAttendance = Number(body.max_attendance || 0);
    const notifyMembers = Boolean(body.notify_members);

    if (!classId) return res.status(400).json({ error: "Class is required" });
    if (!gymId) return res.status(400).json({ error: "Gym is required" });
    if (!date) return res.status(400).json({ error: "Date is required" });
    if (!startHHMM) return res.status(400).json({ error: "Start time is required" });
    if (!endHHMM) return res.status(400).json({ error: "End time is required" });

    const startDate = parseDateTime(date, startHHMM);
    const endDate = parseDateTime(date, endHHMM);

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "Invalid date/time supplied" });
    }

    if (endDate <= startDate) {
      return res.status(400).json({ error: "End time must be after start time" });
    }

    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: "Price must be 0 or greater" });
    }

    if (!Number.isFinite(maxAttendance) || maxAttendance < 1) {
      return res.status(400).json({ error: "Max attendance must be at least 1" });
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

    const now = Timestamp.now();
    const ref = firestore.collection("session").doc();

    await ref.set({
      id: ref.id,
      class_id: classId,
      gym_id: gymId,
      start_time: Timestamp.fromDate(startDate),
      end_time: Timestamp.fromDate(endDate),
      coach_name: coachName || null,
      price,
      max_attendance: Math.floor(maxAttendance),
      current_attendance: 0,
      notify_members: notifyMembers,
      created_at: now,
      updated_at: now,
      created_by: String(session.user.email || "").toLowerCase(),
    });

    let notificationSummary = {
      attempted: 0,
      succeeded: 0,
      failed: 0,
    };

    if (notifyMembers) {
      const usersSnap = await firestore.collection("users").select().get();
      const allEmails = usersSnap.docs
        .map((doc) => String(doc.id || "").trim().toLowerCase())
        .filter(Boolean);

      notificationSummary = await notifyUsersOfNewSession({
        userEmails: allEmails,
        sessionId: ref.id,
        className,
        gymName,
        startDate,
        endDate,
      });
    }

    return res.status(200).json({
      ok: true,
      sessionId: ref.id,
      notifiedUsers: notificationSummary.succeeded,
      notificationFailures: notificationSummary.failed,
    });
  } catch (err: any) {
    console.error("[admin/classes/create-session]", err?.message || err);
    return res.status(500).json({ error: "Failed to create session" });
  }
}
