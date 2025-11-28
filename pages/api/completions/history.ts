
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { email, range } = req.query;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email required" });
  }

  try {
    const col = firestore.collection("workoutCompletions"); // ✅ Use correct collection name
    let query = col.where("user_email", "==", email).orderBy("completed_date", "desc");

    // Fetch completions
    const snap = await query.get();
    if (snap.empty) {
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
    }

    const history = snap.docs
      .map((doc) => {
        const d = doc.data();
        const completedDate = d.completed_date?.toDate?.() || null;
        return {
          id: d.id || doc.id,
          workout_id: d.workout_id || "",
          user_email: d.user_email || email,
          completed_date: completedDate ? completedDate.toISOString() : null,
          calories_burned: d.calories_burned || 0,
          sets_completed: d.sets_completed || 0,
          weight_completed_with: d.weight_completed_with || 0,
          duration: d.duration || 0,
          rating: d.rating || null,
          notes: d.notes || "",
        };
      })
      .filter((item) => {
        if (!startDate || !item.completed_date) return true;
        const completedAt = new Date(item.completed_date);
        return completedAt >= startDate && completedAt <= now;
      });

    return res.status(200).json({ history });
  } catch (err: any) {
    console.error("Failed to fetch completion history:", err.message);
    return res.status(500).json({ error: "Failed to fetch completion history" });
  }
}
