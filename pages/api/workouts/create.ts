
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Not signed in" });

  const role = (session.user as any)?.role || "user";
  if (role !== "admin" && role !== "gym") return res.status(403).json({ error: "Forbidden" });

  const { workout_name, notes, rounds, date } = req.body as {
    workout_name?: string;
    notes?: string;
    rounds?: any[];
    date?: string; // expected format: YYYY-MM-DD
  };

  // Validate input
  if (!workout_name || !rounds || rounds.length !== 10) {
    return res.status(400).json({ error: "Invalid workout data" });
  }
  if (!date) {
    return res.status(400).json({ error: "Workout date is required (YYYY-MM-DD)" });
  }

  try {
    // Convert date string to Firestore Timestamp
    const workoutDate = new Date(`${date}T00:00:00Z`);

    const workoutRef = firestore.collection("workouts").doc();
    const workoutId = workoutRef.id;

    // Create workout document with new date field
    await workoutRef.set({
      workout_id: workoutId,
      workout_name,
      notes: notes || "",
      rounds: 10,
      date: workoutDate, // ✅ new date logic
      created_at: new Date(),
    });

    // Create exercises in batch
    const batch = firestore.batch();
    rounds.forEach((round, i) => {
      if (round.type === "boxing") {
        round.combos.forEach((combo: string, idx: number) => {
          const exRef = firestore.collection("workoutExercises").doc();
          batch.set(exRef, {
            id: exRef.id,
            workout_id: workoutId,
            round: i + 1,
            type: "boxing",
            style: "combo",
            details: combo,
            order: idx + 1,
          });
        });
      } else {
        const exRef = firestore.collection("workoutExercises").doc();
        batch.set(exRef, {
          id: exRef.id,
          workout_id: workoutId,
          round: i + 1,
          type: "kettlebell",
          style: round.style,
          details: round.details,
          order: 1,
        });
      }
    });

    await batch.commit();

    return res.status(200).json({ ok: true, workout_id: workoutId });
  } catch (err: any) {
    console.error("Create workout error:", err.message);
    return res.status(500).json({ error: "Failed to create workout" });
  }
}
