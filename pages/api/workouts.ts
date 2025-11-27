
import type { NextApiRequest, NextApiResponse } from "next";
import { startOfWeek } from "date-fns";
import { Timestamp } from "@google-cloud/firestore";
import firestore from "../../lib/firestoreClient";

interface Workout {
  id: string;
  day: string;
  title: string;
  video?: string;
  notes?: string;
  exercises?: Exercise[];
}

interface Exercise {
  type?: string;
  name?: string;
  video?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const mondayTS = Timestamp.fromDate(monday);
    const sundayTS = Timestamp.fromDate(sunday);

    // Fetch workouts for this week
    const workoutsSnap = await firestore.collection("workouts")
      .where("week_start", ">=", mondayTS)
      .where("week_start", "<=", sundayTS)
      .get();

    if (workoutsSnap.empty) {
      return res.json({ weekStart: monday.toISOString(), workouts: [] });
    }

    const Ws: Workout[] = workoutsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: data.workout_id,
        day: data.day_name,
        title: data.title,
        video: data.video_url || "",
        notes: data.notes || "",
      };
    });

    // Fetch all exercises
    const exercisesSnap = await firestore.collection("workoutExercises")
      .orderBy("order")
      .get();

    const eRows = exercisesSnap.docs.map(doc => doc.data());

    // Attach exercises to workouts
    const workouts = Ws.map(w => ({
      ...w,
      exercises: eRows
        .filter(e => e.workout_id === w.id)
        .map(e => ({
          type: e.type,
          name: e.name,
          video: e.video_url || "",
        })),
    }));

    return res.status(200).json({ weekStart: monday.toISOString(), workouts });
  } catch (err: any) {
    console.error("API /workouts failed:", err.message || err);
    return res.status(500).json({ error: "Failed to load workouts" });
  }
}
