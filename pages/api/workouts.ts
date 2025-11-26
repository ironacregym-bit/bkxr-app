import type { NextApiRequest, NextApiResponse } from "next";
import { startOfWeek, formatISO } from "date-fns";
import { db } from "../../lib/firebaseConfig"; // Your Firestore config
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";

type WorkoutRow = {
  id: string;
  day: string;
  title: string;
  video?: string;
  notes?: string;
};

type ExerciseRow = {
  type?: string;
  name?: string;
  video?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Compute "this week" starting Monday (ISO yyyy-mm-dd)
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekISO = formatISO(monday, { representation: "date" });

    // Fetch workouts for this week
    const workoutsRef = collection(db, "workouts");
    const workoutsQuery = query(workoutsRef, where("week_start", "==", weekISO));
    const workoutSnap = await getDocs(workoutsQuery);

    if (workoutSnap.empty) {
      return res.json({ weekStart: weekISO, workouts: [] });
    }

    // Map workouts
    const Ws: WorkoutRow[] = workoutSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.workout_id,
        day: data.day_name,
        title: data.title,
        video: data.video_url,
        notes: data.notes,
      };
    });

    // Fetch all exercises (we'll filter by workout_id later)
    const exercisesRef = collection(db, "workoutExercises");
    const exercisesQuery = query(exercisesRef, orderBy("order"));
    const exerciseSnap = await getDocs(exercisesQuery);

    const eRows = exerciseSnap.docs.map((doc) => doc.data());

    // Attach exercises to each workout
    const workouts = Ws.map((w) => {
      const items: ExerciseRow[] = eRows
        .filter((e) => e.workout_id === w.id)
        .map((e) => ({
          type: e.type,
          name: e.name,
          video: e.video_url,
        }));
      return { ...w, exercises: items };
    });

    return res.json({ weekStart: weekISO, workouts });
  } catch (err: any) {
    console.error("API /workouts failed:", err?.message || err);
    return res.status(200).json({ weekStart: "", workouts: [] });
  }
}
