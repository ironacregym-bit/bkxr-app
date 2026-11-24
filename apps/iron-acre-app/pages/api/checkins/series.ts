
// pages/api/checkins/series.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

type Row = {
  date: string;            // ISO
  weight_kg: number | null;
  body_fat_pct: number | null;
  photo_url?: string | null;
};

function isoFromAny(v: any): string | null {
  try {
    const d = v?.toDate?.() instanceof Date ? v.toDate() : v ? new Date(v) : null;
    return d && !isNaN(d.getTime()) ? d.toISOString() : null;
  } catch { return null; }
}

function num(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampInt(n: any, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(v)));
}

/** Try to pull YYYY-MM-DD from an id like "email__2025-12-12" */
function ymdFromDocId(id: string): string | null {
  const m = id.match(/__([0-9]{4}-[0-9]{2}-[0-9]{2})$/);
  return m?.[1] ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

    const email = ((req.query.email as string) || session.user.email).trim();
    const limit = clampInt(req.query.limit, 1, 1000, 180);
    const from = (req.query.from as string | undefined)?.trim();
    const to   = (req.query.to as string | undefined)?.trim();

    // Base query: filter by user; avoid orderBy on non-existent fields
    let q = firestore
      .collection("check_ins")
      .where("user_email", "==", email) as FirebaseFirestore.Query;

    // Pull a reasonable number and sort in memory
    // You can raise this if needed, but keep it bounded
    q = q.limit(limit * 3);

    const snap = await q.get();

    const rows: Row[] = snap.docs.map((d) => {
      const x = d.data() as any;

      // Derive ISO date from several possible sources
      const iso =
        isoFromAny(x.week_friday_date) ||
        (typeof x.week_friday_ymd === "string" ? `${x.week_friday_ymd}T12:00:00Z` : null) ||
        (ymdFromDocId(d.id) ? `${ymdFromDocId(d.id)}T12:00:00Z` : null) ||
        isoFromAny(x.date) ||             // if you later add a 'date' field
        isoFromAny(x.created_at) ||
        new Date().toISOString();

      // Weight / body-fat normalisation (accept several names)
      const weight_kg =
        num(x.weight_kg) ??
        num(x.weight) ??
        num(x.stats?.weight_kg) ??
        null;

      const body_fat_pct =
        num(x.body_fat_pct) ??
        num(x.bodyFat) ??
        num(x.stats?.body_fat_pct) ??
        null;

      const photo_url =
        typeof x.photo_url === "string" ? x.photo_url :
        typeof x.photoURL === "string" ? x.photoURL :
        undefined;

      return { date: iso, weight_kg, body_fat_pct, photo_url: photo_url ?? undefined };
    });

    // Optional from/to filtering (inclusive days) in memory
    let filtered = rows;
    if (from || to) {
      const fromDate = from ? new Date(from + "T00:00:00") : null;
      const toDate   = to   ? new Date(to   + "T23:59:59") : null;
      filtered = filtered.filter((r) => {
        const dt = new Date(r.date);
        if (fromDate && dt < fromDate) return false;
        if (toDate && dt > toDate) return false;
        return true;
      });
    }

    // Sort newest first, then cap to limit
    filtered.sort((a, b) => b.date.localeCompare(a.date));
    const results = filtered.slice(0, limit);

    res.setHeader("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    return res.status(200).json({ results });
  } catch (err: any) {
    console.error("[checkins/series] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to load check-ins" });
  }
}
