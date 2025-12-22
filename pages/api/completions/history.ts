
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { email, range, limit } = req.query as { email?: string; range?: string; limit?: string };

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email required" });
  }

  // Default to a small, UI-friendly result set; cap defensively
  const n = Math.min(Math.max(Number(limit || 5), 1), 50);

  try {
    const col = firestore.collection("workoutCompletions");

    // Firestore will suggest an index if needed for where + orderBy combos
    // We keep it simple: filter by user, order by date desc
    const snap = await col
      .where("user_email", "==", email)
      .orderBy("completed_date", "desc")
      .get();

    const now = new Date();

    // Compute range start (local week starts Monday; month is current calendar month)
    let startDate: Date | null = null;
    if (range === "week") {
      const day = now.getDay(); // 0..6 (Sun..Sat)
      const diffToMon = (day + 6) % 7; // distance to Monday
      startDate = new Date(now);
      startDate.setDate(now.getDate() - diffToMon);
      startDate.setHours(0, 0, 0, 0);
    } else if (range === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } // else "all" → startDate stays null

    const allRows = snap.docs.map((doc) => {
      const d = doc.data() as any;

      // Prefer completed_date; fallback to completed_at; otherwise started_at
      const completedJsDate =
        d.completed_date?.toDate?.() instanceof Date
          ? d.completed_date.toDate()
          : d.completed_at?.toDate?.() instanceof Date
          ? d.completed_at.toDate()
          : d.started_at?.toDate?.() instanceof Date
          ? d.started_at.toDate()
          : null;

      return {
        id: d.id || doc.id,
        workout_id: String(d.workout_id || ""),
        user_email: String(d.user_email || email),
        completed_date: completedJsDate ? completedJsDate.toISOString() : null,
        calories_burned: Number(d.calories_burned ?? 0),
        duration: Number(d.duration ?? 0),
        rating: d.rating != null ? Number(d.rating) : null,
        sets_completed: Number(d.sets_completed ?? 0),
        weight_completed_with:
          d.weight_completed_with != null ? Number(d.weight_completed_with) : null,
        notes: typeof d.notes === "string" ? d.notes : "",
        focus: d.focus ? String(d.focus) : null,
      };
    });

    // Range filter in memory (safe and simple)
    const ranged = allRows.filter((row) => {
      if (!startDate || !row.completed_date) return true;
      const completedAt = new Date(row.completed_date);
      return completedAt >= startDate && completedAt <= now;
    });

    // Enforce final limit after range filtering
    const history = ranged.slice(0, n);

    // Cache a bit for snappy UI while revalidating
    res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=30");

    // Return both keys:
    // - results: what Train page expects
    // - history: backwards compatible with your prior usage
    return res.status(200).json({ results: history, history });
  } catch (err: any) {
    console.error("Failed to fetch completion history:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch completion history" });
  }
}
