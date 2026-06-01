// pages/api/admin/sessions/bookings.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import firestore from "../../../../lib/firestoreClient";

type BookingRow = {
  booking_id: string;
  session_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  attendee_label: string;
  attendee_email: string | null;
  status: string;
  payment_method: string | null;
  amount_gbp: number;
  paid: boolean;
  source: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type Resp =
  | {
      items: BookingRow[];
    }
  | { error: string };

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
  res: NextApiResponse<Resp>
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

    const sessionId = String(req.query.session_id || "").trim();

    if (!sessionId) {
      return res.status(400).json({ error: "session_id is required" });
    }

    const sessionDoc = await firestore.collection("session").doc(sessionId).get();

    if (!sessionDoc.exists) {
      return res.status(404).json({ error: "Session not found" });
    }

    const bookingsSnap = await firestore
      .collection("bookings")
      .where("session_id", "==", sessionId)
      .get();

    const rows: BookingRow[] = bookingsSnap.docs.map((doc) => {
      const data = doc.data() as any;

      const userId = data?.user_id ? String(data.user_id).trim().toLowerCase() : null;
      const guestName = data?.guest_name ? String(data.guest_name).trim() : null;
      const guestEmail = data?.guest_email ? String(data.guest_email).trim().toLowerCase() : null;

      const attendeeLabel = userId
        ? userId
        : guestName || guestEmail || "Guest";

      const attendeeEmail = userId || guestEmail || null;

      return {
        booking_id: String(data?.booking_id || doc.id),
        session_id: String(data?.session_id || sessionId),
        user_id: userId,
        guest_name: guestName,
        guest_email: guestEmail,
        attendee_label: attendeeLabel,
        attendee_email: attendeeEmail,
        status: String(data?.status || "unknown"),
        payment_method: data?.payment_method ? String(data.payment_method) : null,
        amount_gbp: Number(data?.amount_gbp || 0),
        paid: Boolean(data?.paid),
        source: data?.source ? String(data.source) : null,
        created_at: toIso(data?.created_at),
        updated_at: toIso(data?.updated_at),
      };
    });

    rows.sort((a, b) => {
      const ams = a.created_at ? Date.parse(a.created_at) : 0;
      const bms = b.created_at ? Date.parse(b.created_at) : 0;
      return bms - ams;
    });

    return res.status(200).json({ items: rows });
  } catch (err: any) {
    console.error("[admin/sessions/bookings]", err?.message || err);
    return res.status(500).json({ error: "Failed to load session bookings" });
  }
}
``
