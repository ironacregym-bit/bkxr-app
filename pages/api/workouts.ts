import type { NextApiRequest, NextApiResponse } from "next";
import { startOfWeek, formatISO } from "date-fns";
import firestore from "../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekISO = formatISO(monday, { representation: "date" });

    // Fetch workouts for this week
    const workoutsSnap = await firestore.collection("workouts")
      .where("week_start", "==", weekISO)
      .get();

    if (workoutsSnap.empty) {
      return res.json({ weekStart: weekISO, workouts: [] });
    }

    const Ws = workoutsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: data.workout_id,
        day: data.day_name,
        title: data.title,
        video: data.video_url,
        notes: data.notes,
      };
    });

    // Fetch exercises
    const exercisesSnap = await firestore.collection("workoutExercises")
      .orderBy("order")
      .get();

    const eRows = exercisesSnap.docs.map(doc => doc.data());

    const workouts = Ws.map(w => ({
      ...w,
      exercises: eRows.filter(e => e.workout_id === w.id)
        .map(e => ({
          type: e.type,
          name: e.name,
          video: e.video_url,
        })),
    }));

    return res.json({ weekStart: weekISO, workouts });
  } catch (err: any) {
    console.error("API /workouts failed:", err.message || err);
    return res.status(200).json({ weekStart: "", workouts: [] });
  }
}
