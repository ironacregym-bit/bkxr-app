
// pages/api/integrations/hdidido/queue.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import firestore from "../../../../lib/firestoreClient";
import { BookingRequest } from "../../../../lib/hdidido/types";
import { authOptions } from "../../auth/[...nextauth]";

/**
 * Accepts a POST with booking details and enqueues a job in
 * `golf_booking_requests` for the runner to pick up.
 *
 * Required body fields (min):
 * - target_date: "YYYY-MM-DD"
 * - target_time: "HH:mm" (24h)
 *
 * Optional:
 * - requester_email (defaults to the signed-in user)
 * - booking_type: "casual" | "competition" | string
 * - members: string[] (names or identifiers)
 * - club_name: string
 * - notes: string
 * - enc_credentials_b64: string (per-job encrypted credentials)
 * - run_at: ISO string; defaults to now + 60s if omitted
 *
 * This route also writes a `task` compatible with the runner:
 *   task: { type: "book", date: target_date, time: target_time, mode: booking_type }
 */
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
      // allow simple alias fields from the client
      date?: string;
      time?: string;
      mode?: string;
    };

    // Field normalisation
    const requester_email = (body.requester_email || session.user.email)!.toString().trim();
    const booking_type = (body.booking_type || body.mode || "casual").toString().trim();

    // Allow date/time aliases
    const target_date = (body.target_date || body.date || "").toString().trim();
    const target_time = (body.target_time || body.time || "").toString().trim();

    if (!target_date) return res.status(400).json({ error: "Missing field: target_date (YYYY-MM-DD)" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
      return res.status(400).json({ error: "Invalid target_date, expected YYYY-MM-DD" });
    }
    if (!target_time) return res.status(400).json({ error: "Missing field: target_time (HH:mm)" });
    if (!/^\d{1,2}:\d{2}$/.test(target_time)) {
      return res.status(400).json({ error: "Invalid target_time, expected HH:mm (24h)" });
    }

    // Members & optional fields
    const members = Array.isArray(body.members) ? body.members : [];
    const club_name = typeof body.club_name === "string" ? body.club_name.trim() : undefined;
    const notes = typeof body.notes === "string" ? body.notes : undefined;
    const enc_credentials_b64 = typeof body.enc_credentials_b64 === "string" ? body.enc_credentials_b64 : undefined;

    // run_at: use provided ISO if valid; otherwise default to now + 60s
    let run_at = body.run_at;
    const runAtDate = run_at ? new Date(run_at) : new Date(Date.now() + 60_000);
    if (isNaN(runAtDate.getTime())) {
      return res.status(400).json({ error: "Invalid run_at; must be ISO or omit to default (now + 60s)" });
    }
    run_at = runAtDate.toISOString();

    const nowIso = new Date().toISOString();

    // Construct the job document (back-compat fields + runner task)
    const doc: BookingRequest & {
      task: { type: "book"; date: string; time: string; mode?: string };
    } = {
      requester_email,
      booking_type,
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
      // New minimal task for the runner
      task: {
        type: "book",
        date: target_date,                // YYYY-MM-DD
        time: target_time,                // HH:mm (runner also tries H:mm)
        mode: booking_type || undefined,  // e.g. "casual" | "competition"
      }
    };

    const ref = await firestore.collection("golf_booking_requests").add(doc);
    return res.status(200).json({ ok: true, id: ref.id, run_at: run_at, task: doc.task });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
