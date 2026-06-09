// pages/api/admin/sessions/recurring-timetables/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { Timestamp } from "@google-cloud/firestore";
import { authOptions } from "../../../auth/[...nextauth]";
import firestore from "../../../../../lib/firestoreClient";

type RecurringTimetableItem = {
  id: string;
  active: boolean;
  class_id: string | null;
  class_name: string;
  gym_id: string | null;
  gym_name: string;
  coach_name?: string | null;
  weekdays: number[];
  start_time_hhmm: string;
  end_time_hhmm: string;
  price: number;
  drop_in_price: number;
  max_attendance: number;
  notify_members: boolean;
  effective_from: string | null;
  effective_to: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
};

type Resp =
  | {
      items: RecurringTimetableItem[];
    }
  | {
      ok: true;
      id: string;
    }
  | {
      error: string;
    };

type Body = {
  active?: boolean;
  class_id?: string;
  gym_id?: string;
  coach_name?: string;
  weekdays?: number[];
  start_time_hhmm?: string;
  end_time_hhmm?: string;
  price?: number;
  drop_in_price?: number;
  max_attendance?: number;
  notify_members?: boolean;
  effective_from?: string | null;
  effective_to?: string | null;
};

function toIso(value: any): string | null {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : null;
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function isValidWeekday(n: unknown): n is number {
  return Number.isInteger(n) && Number(n) >= 0 && Number(n) <= 6;
}

function normaliseYmd(value: string | null | undefined): string | null {
  const v = String(value || "").trim();
  if (!v) return null;

  const parts = v.split("-");
  if (parts.length !== 3) return null;

  const [y, m, d] = parts.map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;

  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (isNaN(dt.getTime())) return null;

  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function isValidTime(value: string | null | undefined) {
  const v = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(v);
}

async function resolveClassDoc(classId: string) {
  const primary = await firestore.collection("classes").doc(classId).get();
  if (primary.exists) return primary.data() as any;

  const legacy = await firestore.collection("gymClasses").doc(classId).get();
  if (legacy.exists) return legacy.data() as any;

  return null;
}

async function resolveGymDoc(gymId: string) {
  const gymDoc = await firestore.collection("gyms").doc(gymId).get();
  return gymDoc.exists ? (gymDoc.data() as any) : null;
}

function compareWeekdayArrays(a: number[], b: number[]) {
  const aKey = [...a].sort((x, y) => x - y).join(",");
  const bKey = [...b].sort((x, y) => x - y).join(",");
  return aKey.localeCompare(bKey);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp>
) {
  try {
    const authSession = await getServerSession(req, res, authOptions);
    const role = (authSession?.user as any)?.role || "user";
    const actorEmail = String(authSession?.user?.email || "").trim().toLowerCase();

    if (!actorEmail || (role !== "admin" && role !== "gym")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (req.method === "GET") {
      const snap = await firestore
        .collection("recurring_timetables")
        .orderBy("updated_at", "desc")
        .get();

      const items: RecurringTimetableItem[] = snap.docs.map((doc) => {
        const data = doc.data() as any;

        return {
          id: doc.id,
          active: Boolean(data?.active),
          class_id: String(data?.class_id || "").trim() || null,
          class_name: String(data?.class_name || data?.class_id || "Class"),
          gym_id: String(data?.gym_id || "").trim() || null,
          gym_name: String(data?.gym_name || data?.gym_id || "Gym"),
          coach_name: data?.coach_name ? String(data.coach_name) : null,
          weekdays: Array.isArray(data?.weekdays)
            ? data.weekdays.filter(isValidWeekday)
            : [],
          start_time_hhmm: String(data?.start_time_hhmm || ""),
          end_time_hhmm: String(data?.end_time_hhmm || ""),
          price: Number(data?.price || 9),
          drop_in_price: Number(data?.drop_in_price || 12),
          max_attendance: Number(data?.max_attendance || 1),
          notify_members: Boolean(data?.notify_members),
          effective_from: normaliseYmd(data?.effective_from) || null,
          effective_to: normaliseYmd(data?.effective_to) || null,
          created_at: toIso(data?.created_at),
          updated_at: toIso(data?.updated_at),
          created_by: data?.created_by ? String(data.created_by) : null,
          updated_by: data?.updated_by ? String(data.updated_by) : null,
        };
      });

      items.sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        const gymCmp = a.gym_name.localeCompare(b.gym_name);
        if (gymCmp !== 0) return gymCmp;
        const wdCmp = compareWeekdayArrays(a.weekdays, b.weekdays);
        if (wdCmp !== 0) return wdCmp;
        const timeCmp = a.start_time_hhmm.localeCompare(b.start_time_hhmm);
        if (timeCmp !== 0) return timeCmp;
        return a.class_name.localeCompare(b.class_name);
      });

      return res.status(200).json({ items });
    }

    if (req.method === "POST") {
      const body = (req.body || {}) as Body;

      const classId = String(body.class_id || "").trim();
      const gymId = String(body.gym_id || "").trim();
      const coachName = String(body.coach_name || "").trim();
      const weekdays = Array.isArray(body.weekdays)
        ? Array.from(new Set(body.weekdays.filter(isValidWeekday))).sort((a, b) => a - b)
        : [];
      const startTime = String(body.start_time_hhmm || "").trim();
      const endTime = String(body.end_time_hhmm || "").trim();
      const price = Number(body.price ?? 9);
      const dropInPrice = Number(body.drop_in_price ?? 12);
      const maxAttendance = Number(body.max_attendance || 0);
      const notifyMembers = Boolean(body.notify_members);
      const active = body.active !== false;
      const effectiveFrom = normaliseYmd(body.effective_from) || null;
      const effectiveTo = normaliseYmd(body.effective_to) || null;

      if (!classId) {
        return res.status(400).json({ error: "Class is required" });
      }

      if (!gymId) {
        return res.status(400).json({ error: "Gym is required" });
      }

      if (!weekdays.length) {
        return res.status(400).json({ error: "At least one weekday is required" });
      }

      if (!isValidTime(startTime)) {
        return res.status(400).json({ error: "Valid start time is required" });
      }

      if (!isValidTime(endTime)) {
        return res.status(400).json({ error: "Valid end time is required" });
      }

      if (endTime <= startTime) {
        return res.status(400).json({ error: "End time must be after start time" });
      }

      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ error: "Prebook price must be 0 or greater" });
      }

      if (!Number.isFinite(dropInPrice) || dropInPrice < 0) {
        return res.status(400).json({ error: "Drop-in price must be 0 or greater" });
      }

      if (!Number.isFinite(maxAttendance) || maxAttendance < 1) {
        return res.status(400).json({ error: "Max attendance must be at least 1" });
      }

      if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
        return res.status(400).json({ error: "Effective end must be on or after effective start" });
      }

      const [classData, gymData] = await Promise.all([
        resolveClassDoc(classId),
        resolveGymDoc(gymId),
      ]);

      if (!classData) {
        return res.status(400).json({ error: "Selected class does not exist" });
      }

      if (!gymData) {
        return res.status(400).json({ error: "Selected gym does not exist" });
      }

      const now = Timestamp.now();
      const ref = firestore.collection("recurring_timetables").doc();

      await ref.set({
        id: ref.id,
        active,
        class_id: classId,
        class_name: String(classData?.name || classData?.title || classData?.class_name || classId),
        gym_id: gymId,
        gym_name: String(gymData?.name || gymId),
        coach_name: coachName || null,
        weekdays,
        start_time_hhmm: startTime,
        end_time_hhmm: endTime,
        price,
        drop_in_price: dropInPrice,
        max_attendance: Math.floor(maxAttendance),
        notify_members: notifyMembers,
        effective_from: effectiveFrom,
        effective_to: effectiveTo,
        created_at: now,
        updated_at: now,
        created_by: actorEmail,
        updated_by: actorEmail,
      });

      return res.status(200).json({ ok: true, id: ref.id });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("[admin/sessions/recurring-timetables/index]", err?.message || err);
    return res.status(500).json({ error: "Failed to handle recurring timetables" });
  }
}
