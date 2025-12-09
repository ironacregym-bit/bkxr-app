
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { email, range } = req.query;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email required" });
  }

  try {
    const col = firestore.collection("workoutCompletions");

    // Firestore may suggest an index for this combination; follow the link once if prompted.
    let query = col.where("user_email", "==", email).orderBy("completed_date", "desc");

    const snap = await query.get();
    if (snap.empty) {
      res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
      return res.status(200).json({ history: [] });
    }

    const now = new Date();
    let startDate: Date | null = null;
    if (range === "week") {
      const day = now.getDay();
      const diffToMon = (day + 6) % 7;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - diffToMon);
      startDate.setHours(0, 0, 0, 0);
    } else if (range === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      // "all" (or undefined): leave startDate null
    }

    const history = snap.docs
      .map((doc) => {
        const d = doc.data() as any;
        const completedDate =
          d.completed_date?.toDate?.() ||
          d.completed_at?.toDate?.() ||
          null;

        return {
          id: d.id || doc.id,
          workout_id: String(d.workout_id || ""),
          user_email: String(d.user_email || email),
          completed_date: completedDate ? completedDate.toISOString() : null,
          calories_burned: Number(d.calories_burned || 0),
          duration: Number(d.duration || 0),
          rating: d.rating != null ? Number(d.rating) : null,
          sets_completed: Number(d.sets_completed || 0),
          weight_completed_with: Number(d.weight_completed_with || 0),
          notes: typeof d.notes === "string" ? d.notes : "",
        };
      })
      .filter((row) => {
        if (!startDate || !row.completed_date) return true;
        const completedAt = new Date(row.completed_date);
        return completedAt >= startDate && completedAt <= now;
      });

    res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
    return res.status(200).json({ history });
  } catch (err: any) {
    console.error("Failed to fetch completion history:", err?.message || err);
    return res.status(500).json({ error: "Failed to fetch completion history" });
  }
}
