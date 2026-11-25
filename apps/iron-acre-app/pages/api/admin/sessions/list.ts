// pages/api/admin/sessions/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

type SessionRow = {
  id: string;
  class_id: string | null;
  class_name: string;
  gym_id: string | null;
  gym_name: string;
  coach_name?: string | null;
  start_time: string | null;
  end_time: string | null;
  price: number;
  drop_in_price: number;
  max_attendance: number;
  current_attendance: number;
  cancelled?: boolean;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
};

type Resp = {
  items: SessionRow[];
};

const ACTIVE_BOOKING_STATUSES = new Set([
  "confirmed",
  "pending_payment",
  "pay_on_day",
  "member_free",
  "bank_pending",
]);

function toIso(value: any): string | null {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d.toISOString() : null;
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function getGymNameMap(gymIds: string[]) {
  if (!gymIds.length) return new Map<string, string>();

  const docs = await firestore.getAll(
    ...gymIds.map((id) => firestore.collection("gyms").doc(id))
  );

  const map = new Map<string, string>();

  for (const doc of docs as any[]) {
    if (!doc?.exists) continue;
    const data = doc.data() as any;
    map.set(doc.id, String(data?.name || doc.id));
  }

  return map;
}

async function getFallbackClassNameMap(classIds: string[]) {
  if (!classIds.length) return new Map<string, string>();

  const out = new Map<string, string>();

  const classDocs = await firestore.getAll(
    ...classIds.map((id) => firestore.collection("classes").doc(id))
  );

  for (const doc of classDocs as any[]) {
    if (!doc?.exists) continue;
    const data = doc.data() as any;
    out.set(doc.id, String(data?.name || data?.title || data?.class_name || doc.id));
  }

  const missing = classIds.filter((id) => !out.has(id));
  if (!missing.length) return out;

  const legacyDocs = await firestore.getAll(
    ...missing.map((id) => firestore.collection("gymClasses").doc(id))
  );

  for (const doc of legacyDocs as any[]) {
    if (!doc?.exists) continue;
    const data = doc.data() as any;
    out.set(doc.id, String(data?.name || data?.title || data?.class_name || doc.id));
  }

  return out;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Resp | { error: string }>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authSession = await getServerSession(req, res, authOptions);
    const role = (authSession?.user as any)?.role || "user";

    if (!authSession?.user?.email || (role !== "admin" && role !== "gym")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const q = String(req.query.q || "").trim().toLowerCase();
    const timing = String(req.query.timing || "upcoming").trim().toLowerCase();
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(300, limitRaw)) : 200;

    const snap = await firestore
      .collection("session")
      .orderBy("start_time", "desc")
      .limit(limit)
      .get();

    const raw = snap.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        data,
        classId: String(data?.class_id || "").trim(),
        className: String(data?.class_name || "").trim(),
        gymId: String(data?.gym_id || "").trim(),
      };
    });

    const classIds = Array.from(new Set(raw.map((x) => x.classId).filter(Boolean)));
    const gymIds = Array.from(new Set(raw.map((x) => x.gymId).filter(Boolean)));

    const [classMap, gymMap] = await Promise.all([
      getFallbackClassNameMap(classIds),
      getGymNameMap(gymIds),
    ]);

    const sessionIds = raw.map((x) => x.id);
    const bookingCounts = new Map<string, number>();

    if (sessionIds.length) {
      const bookingSnaps = await Promise.all(
        sessionIds.map((sessionId) =>
          firestore.collection("bookings").where("session_id", "==", sessionId).get()
        )
      );

      bookingSnaps.forEach((bookingSnap, index) => {
        const sessionId = sessionIds[index];
        const count = bookingSnap.docs.filter((doc) => {
          const booking = doc.data() as any;
          const status = String(booking?.status || "").trim().toLowerCase();
          return ACTIVE_BOOKING_STATUSES.has(status);
        }).length;

        bookingCounts.set(sessionId, count);
      });
    }

    const now = Date.now();

    let items: SessionRow[] = raw.map(({ id, data, classId, className, gymId }) => ({
      id,
      class_id: classId || null,
      class_name: className || classMap.get(classId) || classId || "Class",
      gym_id: gymId || null,
      gym_name: gymMap.get(gymId) || gymId || "Gym",
      coach_name: data?.coach_name ? String(data.coach_name) : null,
      start_time: toIso(data?.start_time),
      end_time: toIso(data?.end_time),
      price: Number(data?.price || 9),
      drop_in_price: Number(data?.drop_in_price || 12),
      max_attendance: Number(data?.max_attendance || 0),
      current_attendance: bookingCounts.get(id) ?? Number(data?.current_attendance || 0),
      cancelled: Boolean(data?.cancelled),
      cancelled_at: toIso(data?.cancelled_at),
      cancelled_by: data?.cancelled_by ? String(data.cancelled_by) : null,
    }));

    if (timing === "upcoming") {
      items = items.filter((item) => {
        if (!item.start_time) return false;
        const ms = Date.parse(item.start_time);
        return !isNaN(ms) && ms >= now;
      });
    } else if (timing === "past") {
      items = items.filter((item) => {
        if (!item.start_time) return false;
        const ms = Date.parse(item.start_time);
        return !isNaN(ms) && ms < now;
      });
    }

    if (q) {
      items = items.filter((item) => {
        const haystack = [
          item.class_name,
          item.class_id || "",
          item.gym_name,
          item.coach_name || "",
          item.id,
          item.cancelled ? "cancelled" : "",
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      });
    }

    items.sort((a, b) => {
      const ams = a.start_time ? Date.parse(a.start_time) : 0;
      const bms = b.start_time ? Date.parse(b.start_time) : 0;

      if (timing === "past") {
        return bms - ams;
      }

      return ams - bms;
    });

    return res.status(200).json({ items });
  } catch (err: any) {
    console.error("[admin/sessions/list]", err?.message || err);
    return res.status(500).json({ error: "Failed to load sessions" });
  }
}
