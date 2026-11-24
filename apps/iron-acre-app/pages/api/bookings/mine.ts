// pages/api/bookings/mine.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

type Resp = {
  sessionIds: string[];
};

const ACTIVE_STATUSES = new Set([
  "confirmed",
  "pending_payment",
  "pay_on_day",
  "bank_pending",
]);

function toDateSafe(value: any): Date | null {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp | { error: string }>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authSession = await getServerSession(req, res, authOptions);
    const userEmail = String(authSession?.user?.email || "").trim().toLowerCase();

    if (!userEmail) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const fromRaw = typeof req.query.from === "string" ? req.query.from : "";
    const toRaw = typeof req.query.to === "string" ? req.query.to : "";

    const fromDate = fromRaw ? new Date(fromRaw) : null;
    const toDate = toRaw ? new Date(toRaw) : null;

    const hasValidFrom = !!fromDate && !isNaN(fromDate.getTime());
    const hasValidTo = !!toDate && !isNaN(toDate.getTime());

    const bookingsSnap = await firestore
      .collection("bookings")
      .where("user_id", "==", userEmail)
      .orderBy("created_at", "desc")
      .limit(200)
      .get();

    const activeBookings = bookingsSnap.docs
      .map((doc) => doc.data() as any)
      .filter((b) => ACTIVE_STATUSES.has(String(b?.status || "").trim().toLowerCase()))
      .map((b) => String(b?.session_id || "").trim())
      .filter(Boolean);

    if (!activeBookings.length) {
      return res.status(200).json({ sessionIds: [] });
    }

    const uniqueSessionIds = Array.from(new Set(activeBookings));
    const sessionRefs = uniqueSessionIds.map((id) => firestore.collection("session").doc(id));
    const sessionSnaps = await firestore.getAll(...sessionRefs);

    const matchedSessionIds: string[] = [];

    for (const snap of sessionSnaps) {
      if (!snap.exists) continue;

      const data = snap.data() as any;
      const start = toDateSafe(data?.start_time);
      if (!start) continue;

      if (hasValidFrom && start < (fromDate as Date)) continue;
      if (hasValidTo && start > (toDate as Date)) continue;

      matchedSessionIds.push(snap.id);
    }

    return res.status(200).json({
      sessionIds: Array.from(new Set(matchedSessionIds)),
    });
  } catch (err: any) {
    console.error("[bookings/mine]", err?.message || err);
    return res.status(500).json({ error: "Failed to load bookings" });
  }
}
