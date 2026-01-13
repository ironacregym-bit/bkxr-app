
// pages/api/classes/today.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

    const email = (req.query.email as string) || session.user.email;

    // Pull recent bookings for this user (cheap), then join sessions and filter to today
    const bookingsSnap = await firestore
      .collection("bookings")
      .where("user_email", "==", email)
      .orderBy("created_at", "desc")
      .limit(25)
      .get();

    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    let best: any | null = null;

    for (const b of bookingsSnap.docs) {
      const bk = b.data() as any;
      const sessionId = bk.session_id;
      if (!sessionId) continue;

      const sDoc = await firestore.collection("session").doc(String(sessionId)).get();
      if (!sDoc.exists) continue;
      const s = sDoc.data() as any;

      // Normalise start_time
      const start =
        s.start_time?.toDate?.() instanceof Date
          ? s.start_time.toDate()
          : s.start_time
          ? new Date(s.start_time)
          : null;
      if (!start) continue;
      if (start < todayStart || start > todayEnd) continue;

      // Resolve optional details
      let className: string | null = null;
      if (s.class_id) {
        const cDoc = await firestore.collection("gymClasses").doc(String(s.class_id)).get();
        if (cDoc.exists) {
          const cd = cDoc.data() as any;
          className = cd.name || cd.title || null;
        }
      }

      let gymName: string | null = null;
      let location: string | null = null;
      if (s.gym_id) {
        const gDoc = await firestore.collection("gyms").doc(String(s.gym_id)).get();
        if (gDoc.exists) {
          const gd = gDoc.data() as any;
          gymName = gd.name || null;
          location = gd.location || null;
        }
      }

      best = {
        id: sDoc.id,
        name: className || s.name || s.title || "Gym session",
        start_time: start.toISOString(),
        gym_name: gymName,
        location,
        coach_name: s.coach_name || null,
      };
      break; // first match for today
    }

    return res.status(200).json({ result: best });
  } catch (err: any) {
    console.error("[classes/today] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to load today’s classes" });
  }
}
