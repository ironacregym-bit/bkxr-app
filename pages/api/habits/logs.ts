
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]"; // ✅ same pattern as your booking API
import { hasRole } from "../../../lib/rbac";

type HabitPayload = {
  // exact field names per your spec
  "2l_water"?: boolean;
  assigned_workouts_completed?: boolean;
  macros_filled?: boolean;
  step_count?: boolean;
  time_outside?: boolean;
  // optional if you want to write these too (but user_email is taken from session)
  id?: string;
  date?: string; // YYYY-MM-DD (if provided in body, query still rules for identity)
};

const COLLECTION = "habitLogs";
const ALLOWED_FIELDS = new Set([
  "2l_water",
  "assigned_workouts_completed",
  "macros_filled",
  "step_count",
  "time_outside",
]);

function isYMD(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function formatYMD(d: Date): string {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n.toISOString().slice(0, 10);
}
function buildDocId(email: string, ymd: string): string {
  return `${email}__${ymd}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth & RBAC (same as your booking style)
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Not signed in" });
  if (!hasRole(session, ["user", "gym", "admin"])) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const user = session.user as any;
  const userEmail: string | undefined = user?.email;
  if (!userEmail) return res.status(400).json({ error: "Unable to resolve user email" });

  // Date identity from query (fallback to today)
  const dateQ = String(req.query.date || formatYMD(new Date()));
  if (!isYMD(dateQ)) return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });

  const docId = buildDocId(userEmail, dateQ);
  const docRef = firestore.collection(COLLECTION).doc(docId);

  // GET: return the day’s habit log
  if (req.method === "GET") {
    try {
      const snap = await docRef.get();
      if (!snap.exists) return res.status(200).json({ entry: null, entries: [] });

      const data = snap.data() || {};
      return res.status(200).json({ entry: data, entries: [data] }); // entries for back-compat
    } catch (err: any) {
      console.error("GET habit log error:", err?.message || err);
      return res.status(500).json({ error: "Failed to read habit log" });
    }
  }

  // POST: upsert only provided fields (merge)
  if (req.method === "POST") {
    const body = (req.body || {}) as HabitPayload;

    // Build the write payload (filter allowed bool fields and coerce to boolean)
    const writeFields: Record<string, boolean> = {};
    Object.keys(body).forEach((k) => {
      if (ALLOWED_FIELDS.has(k)) {
        // @ts-ignore allow accessing "2l_water"
        writeFields[k] = Boolean(body[k as keyof HabitPayload]);
      }
    });

    try {
      await firestore.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        const base = snap.exists ? (snap.data() || {}) : {};

        // identity fields are set/kept consistently
        const next = {
          ...base,
          id: docId,
          user_email: userEmail,
          date: new Date(`${dateQ}T00:00:00Z`), // stored as Firestore Timestamp when set via SDK
          updated_at: new Date(),
          // write only provided allowed fields; leave others intact
          ...writeFields,
        };

        // If creating first time, add created_at
        if (!snap.exists) {
          // created_at only on first write
          (next as any).created_at = new Date();
        }

        tx.set(docRef, next, { merge: true });
      });

      const saved = (await docRef.get()).data() || null;
      return res.status(200).json({ ok: true, entry: saved, entries: saved ? [saved] : [] });
    } catch (err: any) {
      console.error("POST habit log error:", err?.message || err);
      return res.status(500).json({ error: "Failed to upsert habit log" });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
