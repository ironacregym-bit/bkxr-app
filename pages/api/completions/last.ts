// File: pages/api/completions/last.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

const COLLECTION = "workoutCompletions";

function isYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toJSDate(v: any): Date | null {
  try {
    if (!v) return null;
    if (typeof v?.toDate === "function") return v.toDate();
    if (v?.seconds) return new Date(v.seconds * 1000);
    if (typeof v === "string") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  } catch {
    return null;
  }
}

function dayRange(dateYMD: string): { from: Date; to: Date } | null {
  if (!isYMD(dateYMD)) return null;
  const d = new Date(`${dateYMD}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  const from = new Date(d);
  const to = new Date(d);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

function rangeFromTo(fromYMD?: string, toYMD?: string): { from: Date; to: Date } | null {
  if (!fromYMD || !toYMD) return null;
  if (!isYMD(fromYMD) || !isYMD(toYMD)) return null;

  const f = new Date(`${fromYMD}T00:00:00`);
  const t = new Date(`${toYMD}T00:00:00`);
  if (isNaN(f.getTime()) || isNaN(t.getTime())) return null;

  const from = new Date(f);
  from.setHours(0, 0, 0, 0);

  const to = new Date(t);
  to.setHours(23, 59, 59, 999);

  return { from, to };
}

function pickLatestDocInMemory(docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
  if (!docs.length) return undefined;
  return docs
    .map((d) => ({ d, data: d.data() as any }))
    .map(({ d, data }) => {
      const ts =
        toJSDate(data.completed_date) ||
        toJSDate(data.date_completed) ||
        toJSDate(data.created_at) ||
        toJSDate(data.updated_at) ||
        null;
      return { d, when: ts ? ts.getTime() : 0 };
    })
    .sort((a, b) => b.when - a.when)[0]?.d;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // ✅ This endpoint controls “edit vs new” state. Never cache it.
    res.setHeader("Cache-Control", "no-store");

    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const session = await getServerSession(req, res, authOptions);
    const email = session?.user?.email || "";
    if (!email) return res.status(401).json({ error: "Not signed in" });

    const userEmail = email.toLowerCase();
    const workoutId = String(req.query.workout_id || "").trim();

    const fromQ = typeof req.query.from === "string" ? req.query.from.trim() : undefined;
    const toQ = typeof req.query.to === "string" ? req.query.to.trim() : undefined;
    const dateQ = typeof req.query.date === "string" ? req.query.date.trim() : undefined;

    const weekRange = rangeFromTo(fromQ, toQ);
    const dayPref = dateQ ? dayRange(dateQ) : null;

    // ✅ If caller supplied date or week range, be strict: do NOT fall back to “latest overall”
    const strictWindow = Boolean(dayPref || weekRange);

    let base = firestore.collection(COLLECTION).where("user_email", "==", userEmail) as FirebaseFirestore.Query;
    if (workoutId) base = base.where("workout_id", "==", workoutId);

    let doc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

    // 1) Prefer a completion on the requested day
    if (dayPref) {
      try {
        const snap = await base
          .where("completed_date", ">=", dayPref.from)
          .where("completed_date", "<=", dayPref.to)
          .orderBy("completed_date", "desc")
          .limit(1)
          .get();
        if (!snap.empty) doc = snap.docs[0];
      } catch {
        // index missing -> scan below
      }

      if (!doc) {
        const snap = await base.limit(workoutId ? 150 : 300).get();
        const filtered = snap.docs.filter((d) => {
          const x = d.data() as any;
          const dt = toJSDate(x.completed_date) || toJSDate(x.date_completed) || null;
          return dt ? dt >= dayPref.from && dt <= dayPref.to : false;
        });
        doc = pickLatestDocInMemory(filtered);
      }
    }

    // 2) Else use week window
    if (!doc && weekRange) {
      try {
        const snap = await base
          .where("completed_date", ">=", weekRange.from)
          .where("completed_date", "<=", weekRange.to)
          .orderBy("completed_date", "desc")
          .limit(1)
          .get();
        if (!snap.empty) doc = snap.docs[0];
      } catch {
        // index missing -> scan below
      }

      if (!doc) {
        const snap = await base.limit(workoutId ? 200 : 400).get();
        const filtered = snap.docs.filter((d) => {
          const x = d.data() as any;
          const dt = toJSDate(x.completed_date) || toJSDate(x.date_completed) || null;
          return dt ? dt >= weekRange.from && dt <= weekRange.to : false;
        });
        doc = pickLatestDocInMemory(filtered);
      }
    }

    // ✅ If strict window and nothing found, stop here
    if (!doc && strictWindow) {
      return res.status(200).json({ ok: true, last: null });
    }

    // 3) Non-strict fallback: latest overall (existing behaviour)
    if (!doc) {
      try {
        const snap = await base.orderBy("completed_date", "desc").limit(1).get();
        if (!snap.empty) doc = snap.docs[0];
      } catch {
        // ignore
      }
    }

    // 4) Legacy fallback: date_completed ordering
    if (!doc) {
      try {
        const snap2 = await base.orderBy("date_completed", "desc").limit(1).get();
        if (!snap2.empty) doc = snap2.docs[0];
      } catch {
        // ignore
      }
    }

    // 5) Final fallback: scan and pick latest
    if (!doc) {
      const scanLimit = workoutId ? 50 : 100;
      const snap3 = await base.limit(scanLimit).get();
      if (!snap3.empty) doc = pickLatestDocInMemory(snap3.docs);
    }

    if (!doc) {
      return res.status(200).json({ ok: true, last: null });
    }

    const x = doc.data() as any;

    const last = {
      id: doc.id,
      workout_id: x.workout_id ?? (workoutId || null),
      workout_name: x.workout_name ?? null,

      completed_date: x.completed_date ?? null,
      date_completed: x.date_completed ?? null,

      calories_burned: typeof x.calories_burned === "number" ? x.calories_burned : null,
      duration_minutes: typeof x.duration_minutes === "number" ? x.duration_minutes : null,
      duration: typeof x.duration === "number" ? x.duration : null,
      rpe: typeof x.rpe === "number" ? x.rpe : null,
      rating: typeof x.rating === "number" ? x.rating : null,
      notes: typeof x.notes === "string" ? x.notes : null,

      weight_completed_with:
        typeof x.weight_completed_with === "number"
          ? x.weight_completed_with
          : typeof x.weight_completed_with === "string"
          ? x.weight_completed_with
          : null,

      activity_type: x.activity_type ? String(x.activity_type) : null,
      sets: Array.isArray(x.sets) ? x.sets : [],

      is_benchmark: x.is_benchmark === true,
      benchmark_metrics: x.benchmark_metrics && typeof x.benchmark_metrics === "object" ? x.benchmark_metrics : null,
      sets_completed: typeof x.sets_completed === "number" ? x.sets_completed : null,
    };

    return res.status(200).json({ ok: true, last });
  } catch (err: any) {
    console.error("[completions/last] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch last completion" });
  }
}
