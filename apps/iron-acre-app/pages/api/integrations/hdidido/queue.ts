
// pages/api/integrations/hdidido/queue.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import firestore from "../../../../lib/firestoreClient";
import { BookingRequest } from "../../../../lib/hdidido/types";
// ⬇️ If your types file exports BookingType, import it (preferred)
import type { BookingType } from "../../../../lib/hdidido/types";

import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  try {
    const body = req.body as Partial<BookingRequest> & {
      // allow client aliases
      date?: string;
      time?: string;
      mode?: string;
    };

    // Normalise requester
    const requester_email = (body.requester_email || session.user.email)!.toString().trim();

    // 🔧 Narrow 'booking_type' to union
    const rawType = (body.booking_type || body.mode || "casual")?.toString().toLowerCase();
    const ALLOWED: BookingType[] = ["casual", "competition"];
    const booking_type: BookingType = (ALLOWED.includes(rawType as BookingType)
      ? (rawType as BookingType)
      : "casual");

    // Date/time can arrive as aliases
    const target_date = (body.target_date || body.date || "").toString().trim();
    const target_time = (body.target_time || body.time || "").toString().trim();

    // Basic validation
    if (!target_date) return res.status(400).json({ error: "Missing field: target_date (YYYY-MM-DD)" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
      return res.status(400).json({ error: "Invalid target_date, expected YYYY-MM-DD" });
    }
    if (!target_time) return res.status(400).json({ error: "Missing field: target_time (HH:mm)" });
    if (!/^\d{1,2}:\d{2}$/.test(target_time)) {
      return res.status(400).json({ error: "Invalid target_time, expected HH:mm (24h)" });
    }

    const members = Array.isArray(body.members) ? body.members : [];
    const club_name = typeof body.club_name === "string" ? body.club_name.trim() : undefined;
    const notes = typeof body.notes === "string" ? body.notes : undefined;
    const enc_credentials_b64 = typeof body.enc_credentials_b64 === "string" ? body.enc_credentials_b64 : undefined;

    // run_at: use provided or default to now + 60s
    let run_at = body.run_at;
    const runAtDate = run_at ? new Date(run_at) : new Date(Date.now() + 60_000);
    if (isNaN(runAtDate.getTime())) {
      return res.status(400).json({ error: "Invalid run_at; must be ISO or omit to default (now + 60s)" });
    }
    run_at = runAtDate.toISOString();

    const nowIso = new Date().toISOString();

    // Build document (keeps back-compat fields + adds 'task' for runner)
    const doc: BookingRequest & {
      task: { type: "book"; date: string; time: string; mode?: BookingType };
    } = {
      requester_email,
      booking_type,        // ✅ now BookingType
      club_name,
      target_date,
      target_time,
      time_window_secs: body.time_window_secs ?? 45,
      members,
      run_at,
      notes,
      enc_credentials_b64,
      status: "queued",
      attempts: 0,
      created_at: nowIso,
      task: {
        type: "book",
        date: target_date,
        time: target_time,
        mode: booking_type,
      },
    };

    const ref = await firestore.collection("golf_booking_requests").add(doc);
    return res.status(200).json({ ok: true, id: ref.id, run_at, task: doc.task });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
