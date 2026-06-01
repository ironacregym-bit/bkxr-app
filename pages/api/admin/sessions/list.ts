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
  max_attendance: number;
  current_attendance: number;
};

type Resp = {
  items: SessionRow[];
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

    const classIds = Array.from(
      new Set(
        snap.docs
          .map((doc) => String((doc.data() as any)?.class_id || "").trim())
          .filter(Boolean)
      )
    );

    const gymIds = Array.from(
      new Set(
        snap.docs
          .map((doc) => String((doc.data() as any)?.gym_id || "").trim())
          .filter(Boolean)
      )
    );

    const [classDocs, gymDocs] = await Promise.all([
      classIds.length
        ? firestore.getAll(...classIds.map((id) => firestore.collection("gymClasses").doc(id)))
        : Promise.resolve([]),
      gymIds.length
        ? firestore.getAll(...gymIds.map((id) => firestore.collection("gyms").doc(id)))
        : Promise.resolve([]),
    ]);

    const classMap = new Map<string, string>();
    const gymMap = new Map<string, string>();

    for (const doc of classDocs as any[]) {
      if (!doc?.exists) continue;
      const data = doc.data() as any;
      classMap.set(doc.id, String(data?.name || data?.title || doc.id));
    }

    for (const doc of gymDocs as any[]) {
      if (!doc?.exists) continue;
      const data = doc.data() as any;
      gymMap.set(doc.id, String(data?.name || doc.id));
    }

    const now = Date.now();

    let items: SessionRow[] = snap.docs.map((doc) => {
      const data = doc.data() as any;
      const classId = String(data?.class_id || "").trim() || null;
      const gymId = String(data?.gym_id || "").trim() || null;

      return {
        id: doc.id,
        class_id: classId,
        class_name: classId ? classMap.get(classId) || classId : "Class",
        gym_id: gymId,
        gym_name: gymId ? gymMap.get(gymId) || gymId : "Gym",
        coach_name: data?.coach_name ? String(data.coach_name) : null,
        start_time: toIso(data?.start_time),
        end_time: toIso(data?.end_time),
        price: Number(data?.price || 0),
        max_attendance: Number(data?.max_attendance || 0),
        current_attendance: Number(data?.current_attendance || 0),
      };
    });

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
          item.gym_name,
          item.coach_name || "",
          item.id,
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
