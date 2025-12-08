
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
    // We avoid schema assumptions; we merge provided fields.
    // If you want to restrict fields, we can later add an ALLOWED_FIELDS filter.
    const body = (req.body || {}) as Record<string, any>;

    try {
      await firestore.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        const base = snap.exists ? (snap.data() || {}) : {};

        const next = {
          ...base,
          id: docId,
          user_email: userEmail,
          week_friday_date: friday, // Firestore Timestamp on write via SDK
          week_friday_ymd: fridayYMD,
          updated_at: new Date(),
          // Merge user-provided fields (notes, mood, sleep_hours, etc.)
          ...body,
        };

        if (!snap.exists) {
          (next as any).created_at = new Date();
        }

        tx.set(docRef, next, { merge: true });
      });

      const saved = (await docRef.get()).data() || null;
      return res.status(200).json({ ok: true, entry: saved, entries: saved ? [saved] : [] });
    } catch (err: any) {
      console.error("POST check-in error:", err?.message || err);
      return res.status(500).json({ error: "Failed to upsert check-in" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
