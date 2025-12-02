
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]"; // ✅ Correct import path
import { hasRole } from "../../../lib/rbac";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Not signed in" });
  }

  if (!hasRole(session, ["user", "gym", "admin"])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { session_id } = req.body as { session_id?: string };
  if (!session_id) {
    return res.status(400).json({ error: "session_id is required" });
  }

  // ✅ Safe access to session.user
  const user = session.user as any;
  const uid = user?.id || user?.uid || user?.email;
  if (!uid) {
    return res.status(400).json({ error: "Unable to resolve user id" });
  }

  try {
    const sessionRef = firestore.collection("session").doc(session_id);
    const bookingId = `${session_id}_${uid}`;
    const bookingRef = firestore.collection("bookings").doc(bookingId);

    await firestore.runTransaction(async (tx) => {
      const sessSnap = await tx.get(sessionRef);
      if (!sessSnap.exists) throw new Error("Session not found");
      const sessData = sessSnap.data() as any;
      const max = Number(sessData?.max_attendance) || 0;

      // Count confirmed bookings for this session
      const confirmedSnap = await firestore
        .collection("bookings")
        .where("session_id", "==", session_id)
        .where("status", "==", "confirmed")
        .get();

      if (max > 0 && confirmedSnap.size >= max) {
        throw new Error("Session is full");
      }

      // Idempotency: if booking already exists and confirmed, do nothing
      const existing = await tx.get(bookingRef);
      if (existing.exists && existing.data()?.status === "confirmed") {
        return;
      }

      tx.set(bookingRef, {
        booking_id: bookingId,
        session_id,
        user_id: uid,
        status: "confirmed",
        created_at: new Date(),
      });
    });

    return res.status(200).json({ ok: true, booking_id: bookingId });
  } catch (err: any) {
    console.error("Create booking error:", err.message);
    const msg = err.message || "Failed to create booking";
    const code = msg === "Session is full" ? 409 : 500;
    return res.status(code).json({ error: msg });
  }
}
