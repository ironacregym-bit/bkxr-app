
// /pages/api/checkins/weekly.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { hasRole } from "../../../lib/rbac";

// ---- Helpers (aligned to your index logic)
function isYMD(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function formatYMD(d: Date): string {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n.toISOString().slice(0, 10);
}
function startOfAlignedWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun..6=Sat
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

const COLLECTION = "check_ins";

// Basic server-side validation for image data URLs to avoid oversized docs
function isValidImageDataUrl(s: unknown): s is string {
  if (typeof s !== "string") return false;
  // Accept JPEG/PNG/WebP; add more types if needed
  return (
    s.startsWith("data:image/jpeg") ||
    s.startsWith("data:image/png") ||
    s.startsWith("data:image/webp")
  );
}
// Firestore doc hard limit ~1MiB; keep photos conservative per field
const MAX_DATAURL_LEN = 900_000; // ~900 KB per photo (client compresses already)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Not signed in" });
  if (!hasRole(session, ["user", "gym", "admin"])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const user = session.user as any;
  const userEmail: string | undefined = user?.email;
  if (!userEmail) return res.status(400).json({ error: "Unable to resolve user email" });

  // Identify week via query (?week=YYYY-MM-DD), default to today
  const weekQ = String(req.query.week || formatYMD(new Date()));
  if (!isYMD(weekQ)) return res.status(400).json({ error: "Invalid week format. Use YYYY-MM-DD." });

  const weekDate = new Date(`${weekQ}T00:00:00Z`);
  const friday = fridayOfWeek(weekDate);
  const fridayYMD = formatYMD(friday);

  const docId = buildDocId(userEmail, fridayYMD);
  const docRef = firestore.collection(COLLECTION).doc(docId);

  if (req.method === "GET") {
    try {
      const snap = await docRef.get();
      if (!snap.exists) {
        // index code expects { entry: null } when not found
        return res.status(200).json({ entry: null, entries: [] });
      }
      const data = snap.data() || {};
      return res.status(200).json({ entry: data, entries: [data] });
    } catch (err: any) {
      console.error("GET check-in error:", err?.message || err);
      return res.status(500).json({ error: "Failed to read check-in" });
    }
  }

  if (req.method === "POST") {
    const body = (req.body || {}) as Record<string, any>;

    // ---- Normalise & validate fields per your sample
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

    // Progress photos (data URLs)
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

    // Size guards (if too large, drop with a warning; client compresses already)
    if (progress_photo_front && progress_photo_front.length > MAX_DATAURL_LEN) {
      console.warn(
        `[checkins] front photo too large (${progress_photo_front.length}). Dropping.`
      );
      progress_photo_front = undefined;
    }
    if (progress_photo_side && progress_photo_side.length > MAX_DATAURL_LEN) {
      console.warn(
        `[checkins] side photo too large (${progress_photo_side.length}). Dropping.`
      );
      progress_photo_side = undefined;
    }
    if (progress_photo_back && progress_photo_back.length > MAX_DATAURL_LEN) {
      console.warn(
        `[checkins] back photo too large (${progress_photo_back.length}). Dropping.`
      );
      progress_photo_back = undefined;
    }

    try {
      await firestore.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        const base = snap.exists ? (snap.data() || {}) : {};

        const next = {
          ...base,
          id: docId,
          user_email: userEmail,
          week_friday_date: friday, // stored as JS Date by client SDK
          week_friday_ymd: fridayYMD,
          updated_at: new Date(),

          // Only include when provided to avoid clobbering previous values
          ...(averge_hours_of_sleep !== undefined && { averge_hours_of_sleep }),
          ...(body_fat_pct !== undefined && { body_fat_pct }),
          ...(energy_levels !== undefined && { energy_levels }),
          ...(stress_levels !== undefined && { stress_levels }),
          ...(calories_difficulty !== undefined && { calories_difficulty }),
          ...(weekly_goals_achieved !== undefined && { weekly_goals_achieved }),
          ...(next_week_goals !== undefined && { next_week_goals }),
          ...(notes !== undefined && { notes }),
          ...(weight !== undefined && { weight }),

          ...(progress_photo_front !== undefined && { progress_photo_front }),
          ...(progress_photo_side !== undefined && { progress_photo_side }),
          ...(progress_photo_back !== undefined && { progress_photo_back }),
        };

        if (!snap.exists) {
          (next as any).created_at = new Date();
          (next as any).date_completed = new Date(); // compatibility with earlier reads
        }

        tx.set(docRef, next, { merge: true });
      });

      const saved = (await docRef.get()).data() || null;
      return res
        .status(200)
        .json({ ok: true, entry: saved, entries: saved ? [saved] : [] });
    } catch (err: any) {
      console.error("POST check-in error:", err?.message || err);
      return res.status(500).json({ error: "Failed to upsert check-in" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });

