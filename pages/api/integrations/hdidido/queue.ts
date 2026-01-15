
// pages/api/integrations/hdidido/queue.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import firestore from "../../../../lib/firestoreClient";
import { BookingRequest } from "../../../../lib/hdidido/types";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, {} as any);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorised" });

  try {
    const body = req.body as Partial<BookingRequest>;
    // Minimal required fields
    const required = ["requester_email", "booking_type", "target_date", "target_time", "members", "run_at"] as const;
    for (const k of required) {
      if (!(body as any)[k]) return res.status(400).json({ error: `Missing field: ${k}` });
    }

    const nowIso = new Date().toISOString();
    const doc: BookingRequest = {
      requester_email: body.requester_email!,
      booking_type: body.booking_type!,
      club_name: body.club_name,
      target_date: body.target_date!,
      target_time: body.target_time!,
      time_window_secs: body.time_window_secs ?? 45,
      members: Array.isArray(body.members) ? body.members : [],
      run_at: body.run_at!,
      notes: body.notes,
      enc_credentials_b64: body.enc_credentials_b64,
      status: "queued",
      attempts: 0,
      created_at: nowIso
    };

    const ref = await firestore.collection("golf_booking_requests").add(doc);
    return res.status(200).json({ ok: true, id: ref.id });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
