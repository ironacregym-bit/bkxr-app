import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../auth/[...nextauth]";
import firestore from "../../../../../lib/firestoreClient";
import { hasRole } from "../../../../../lib/rbac";

// ---- Helpers (aligned with /api/checkins/weekly.ts) -----------------------
function isYMD(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function formatYMD(d: Date): string {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n.toISOString().slice(0, 10);
}
function startOfAlignedWeek(d: Date): Date {
  const day = d.getDay(); // 0..6 (Sun..Sat)
  const diffToMon = (day + 6) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - diffToMon);
  s.setHours(0, 0, 0, 0);
  return s;
}
function fridayOfWeek(d: Date): Date {
  const s = startOfAlignedWeek(d);
  const f = new Date(s);
  f.setDate(s.getDate() + 4); // Monday + 4 = Friday
  f.setHours(0, 0, 0, 0);
  return f;
}
function buildDocId(email: string, ymd: string): string {
  return `${email}__${ymd}`;
}

// Basic validation for image data URLs (server-side)
function isValidImageDataUrl(s: unknown): s is string {
  if (typeof s !== "string") return false;
  return (
    s.startsWith("data:image/jpeg") ||
    s.startsWith("data:image/png") ||
    s.startsWith("data:image/webp")
  );
}
const MAX_DATAURL_LEN = 900_000; // align with /api/checkins/weekly.ts

const COLLECTION = "check_ins";

const BASE =
  process.env.NEXTAUTH_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

// Non-fatal emitter
async function emitCongrats(email: string, checkinIso: string) {
  if (!BASE) return;
  try {
    await fetch(`${BASE}/api/notify/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "friday_checkin_congrats",
        email,
        context: { checkin_at: checkinIso },
        force: false,
      }),
    });
  } catch {
    // swallow
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Not signed in" });
  if (!hasRole(session, ["admin", "gym"])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Admin chooses which member they are writing for
  const email =
    (typeof req.query.email === "string" && req.query.email.trim()) ||
    (typeof (req.body || {}).user_email === "string" && (req.body as any).user_email.trim()) ||
    "";

  if (!email) return res.status(400).json({ error: "Missing target email" });

  // Identify week via query (?week=YYYY-MM-DD), default to today
  const weekQ = String(req.query.week || formatYMD(new Date()));
  if (!isYMD(weekQ)) return res.status(400).json({ error: "Invalid week format. Use YYYY-MM-DD." });

  const weekDate = new Date(`${weekQ}T00:00:00`);
  if (isNaN(weekDate.getTime())) return res.status(400).json({ error: "Invalid week date" });

  const friday = fridayOfWeek(weekDate);
  const fridayYMD = formatYMD(friday);

  const docId = buildDocId(email, fridayYMD);
  const docRef = firestore.collection(COLLECTION).doc(docId);

  if (req.method === "GET") {
    try {
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(200).json({ entry: null, entries: [], fridayYMD, id: docId });
      }
      const data = snap.data() || {};
      return res.status(200).json({ entry: data, entries: [data], fridayYMD, id: docId });
    } catch (err: any) {
      console.error("[admin checkins/create][GET] error:", err?.message || err);
      return res.status(500).json({ error: "Failed to read check-in" });
    }
  }

  if (req.method === "POST") {
    const body = (req.body || {}) as Record<string, any>;

    // ---- Normalise & validate fields (Option 2, mirroring your weekly route)
    const averge_hours_of_sleep =
      body.averge_hours_of_sleep != null ? String(body.averge_hours_of_sleep) : undefined;
    const body_fat_pct =
      body.body_fat_pct != null ? String(body.body_fat_pct) : undefined;
    const energy_levels =
      body.energy_levels != null ? String(body.energy_levels) : undefined;
    const stress_levels =
      body.stress_levels != null ? String(body.stress_levels) : undefined;
    const calories_difficulty =
      body.calories_difficulty != null ? String(body.calories_difficulty) : undefined;

    const weekly_goals_achieved =
      body.weekly_goals_achieved != null ? !!body.weekly_goals_achieved : undefined;
    const next_week_goals =
      body.next_week_goals != null ? String(body.next_week_goals) : undefined;
    const notes = body.notes != null ? String(body.notes) : undefined;

    const weight =
      body.weight != null
        ? typeof body.weight === "number"
          ? body.weight
          : Number(body.weight)
        : undefined;

    // Photos (data URLs)
    let progress_photo_front =
      body.progress_photo_front && isValidImageDataUrl(body.progress_photo_front)
        ? String(body.progress_photo_front)
        : undefined;
    let progress_photo_side =
      body.progress_photo_side && isValidImageDataUrl(body.progress_photo_side)
        ? String(body.progress_photo_side)
        : undefined;
    let progress_photo_back =
      body.progress_photo_back && isValidImageDataUrl(body.progress_photo_back)
        ? String(body.progress_photo_back)
        : undefined;

    // Also accept plural keys (to keep current UI displays working without changing renders)
    let progress_photos_side =
      body.progress_photos_side && isValidImageDataUrl(body.progress_photos_side)
        ? String(body.progress_photos_side)
        : undefined;
    let progress_photos_back =
      body.progress_photos_back && isValidImageDataUrl(body.progress_photos_back)
        ? String(body.progress_photos_back)
        : undefined;

    const clear_front = body.clear_photo_front === true;
    const clear_side = body.clear_photo_side === true;
    const clear_back = body.clear_photo_back === true;

    // Size guards
    if (progress_photo_front && progress_photo_front.length > MAX_DATAURL_LEN) {
      console.warn(`[admin checkins] front photo too large (${progress_photo_front.length}). Dropping.`);
      progress_photo_front = undefined;
    }
    if (progress_photo_side && progress_photo_side.length > MAX_DATAURL_LEN) {
      console.warn(`[admin checkins] side photo too large (${progress_photo_side.length}). Dropping.`);
      progress_photo_side = undefined;
    }
    if (progress_photo_back && progress_photo_back.length > MAX_DATAURL_LEN) {
      console.warn(`[admin checkins] back photo too large (${progress_photo_back.length}). Dropping.`);
      progress_photo_back = undefined;
    }
    if (progress_photos_side && progress_photos_side.length > MAX_DATAURL_LEN) {
      console.warn(`[admin checkins] photos_side too large (${progress_photos_side.length}). Dropping.`);
      progress_photos_side = undefined;
    }
    if (progress_photos_back && progress_photos_back.length > MAX_DATAURL_LEN) {
      console.warn(`[admin checkins] photos_back too large (${progress_photos_back.length}). Dropping.`);
      progress_photos_back = undefined;
    }

    try {
      await firestore.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        const base = snap.exists ? (snap.data() || {}) : {};

        const next: any = {
          ...base,
          id: docId,
          user_email: email,
          week_friday_date: friday, // Timestamp in Firestore
          week_friday_ymd: fridayYMD,
          updated_at: new Date(),
          ...(averge_hours_of_sleep !== undefined && { averge_hours_of_sleep }),
          ...(body_fat_pct !== undefined && { body_fat_pct }),
          ...(energy_levels !== undefined && { energy_levels }),
          ...(stress_levels !== undefined && { stress_levels }),
          ...(calories_difficulty !== undefined && { calories_difficulty }),
          ...(weekly_goals_achieved !== undefined && { weekly_goals_achieved }),
          ...(next_week_goals !== undefined && { next_week_goals }),
          ...(notes !== undefined && { notes }),
          ...(weight !== undefined && { weight }),
        };

        // Photos (set/keep/clear). Write both singular and plural keys (compat).
        if (progress_photo_front !== undefined) next.progress_photo_front = progress_photo_front;
        if (progress_photo_side !== undefined) next.progress_photo_side = progress_photo_side;
        if (progress_photo_back !== undefined) next.progress_photo_back = progress_photo_back;

        if (progress_photos_side !== undefined) next.progress_photos_side = progress_photos_side;
        if (progress_photos_back !== undefined) next.progress_photos_back = progress_photos_back;

        if (clear_front) delete next.progress_photo_front;
        if (clear_side) {
          delete next.progress_photo_side;
          delete next.progress_photos_side;
        }
        if (clear_back) {
          delete next.progress_photo_back;
          delete next.progress_photos_back;
        }

        if (!snap.exists) {
          next.created_at = new Date();
          next.date_completed = new Date();
        }

        tx.set(docRef, next, { merge: true });
      });

      const nowIso = new Date().toISOString();
      await firestore.collection("users").doc(email).set(
        {
          last_checkin_at: nowIso,
          last_checkin_week_friday_ymd: fridayYMD,
        },
        { merge: true }
      );

      await emitCongrats(email, nowIso);

      const saved = (await docRef.get()).data() || null;
      return res
        .status(200)
        .json({ ok: true, entry: saved, entries: saved ? [saved] : [], fridayYMD, id: docId });
    } catch (err: any) {
      console.error("[admin checkins/create][POST] error:", err?.message || err);
      return res.status(500).json({ error: "Failed to upsert check-in" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
