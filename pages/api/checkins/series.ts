
// pages/api/checkins/series.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

type Row = {
  date: string;           // ISO
  weight_kg: number | null;
  body_fat_pct: number | null;
  photo_url?: string | null;  // optional passthrough if present
};

function isoFromAny(v: any): string | null {
  try {
    const d = v?.toDate?.() instanceof Date ? v.toDate() : v ? new Date(v) : null;
    if (!d || isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

function numOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

    const email = ((req.query.email as string) || session.user.email).trim();
    const limit = Math.min(Math.max(Number(req.query.limit || 180), 1), 1000); // default ~6 months
    const from = (req.query.from as string | undefined)?.trim();
    const to = (req.query.to as string | undefined)?.trim();

    // Base query: most recent first
    let q = firestore
      .collection("check_ins")
      .where("user_email", "==", email)
      .orderBy("date", "desc") as FirebaseFirestore.Query;

    // Optional range
    let fromDate: Date | null = null;
    let toDate: Date | null = null;
    if (from) { const f = new Date(from); if (!isNaN(f.getTime())) { f.setHours(0,0,0,0); fromDate = f; } }
    if (to)   { const t = new Date(to);   if (!isNaN(t.getTime())) { t.setHours(23,59,59,999); toDate = t; } }
    if (fromDate) q = q.where("date", ">=", fromDate);
    if (toDate)   q = q.where("date", "<=", toDate);

    q = q.limit(limit);

    const snap = await q.get();
    const rows: Row[] = snap.docs.map(d => {
      const x = d.data() as any;
      const dateIso = isoFromAny(x.date) || isoFromAny(x.created_at) || isoFromAny(d.createTime?.toDate?.());
      return {
        date: dateIso || new Date().toISOString(),
        weight_kg: numOrNull(x.weight_kg ?? x.weight),
        body_fat_pct: numOrNull(x.body_fat_pct ?? x.bodyFat),
        photo_url: typeof x.photo_url === "string" ? x.photo_url : undefined,
      };
    });

    // Return newest first but page can reverse when rendering chart if needed
    return res.status(200).json({ results: rows });
  } catch (err: any) {
    console.error("[checkins/series] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to load check-in series" });
  }
}
