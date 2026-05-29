// pages/api/admin/sessions/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

type Resp = {
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
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  notify_members?: boolean;
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

    const id = String(req.query.id || "").trim();

    if (!id) {
      return res.status(400).json({ error: "Missing id" });
    }

    const doc = await firestore.collection("session").doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Session not found" });
    }

    const data = doc.data() as any;
    const classId = String(data?.class_id || "").trim() || null;
    const gymId = String(data?.gym_id || "").trim() || null;

    let className = classId || "Class";
    let gymName = gymId || "Gym";

    if (classId) {
      const classDoc = await firestore.collection("gymClasses").doc(classId).get();
      if (classDoc.exists) {
        const classData = classDoc.data() as any;
        className = String(classData?.name || classData?.title || classId);
      }
    }

    if (gymId) {
      const gymDoc = await firestore.collection("gyms").doc(gymId).get();
      if (gymDoc.exists) {
        const gymData = gymDoc.data() as any;
        gymName = String(gymData?.name || gymId);
      }
    }

    return res.status(200).json({
      id: doc.id,
      class_id: classId,
      class_name: className,
      gym_id: gymId,
      gym_name: gymName,
      coach_name: data?.coach_name ? String(data.coach_name) : null,
      start_time: toIso(data?.start_time),
      end_time: toIso(data?.end_time),
      price: Number(data?.price || 0),
      max_attendance: Number(data?.max_attendance || 0),
      current_attendance: Number(data?.current_attendance || 0),
      created_at: toIso(data?.created_at),
      updated_at: toIso(data?.updated_at),
      created_by: data?.created_by ? String(data.created_by) : null,
      notify_members: Boolean(data?.notify_members),
    });
  } catch (err: any) {
    console.error("[admin/sessions/get]", err?.message || err);
    return res.status(500).json({ error: "Failed to load session" });
  }
}
