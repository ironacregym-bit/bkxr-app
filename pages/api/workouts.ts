
import type { NextApiRequest, NextApiResponse } from "next";
import { startOfWeek } from "date-fns";
import { Timestamp } from "@google-cloud/firestore";
import firestore from "../../lib/firestoreClient";

interface Workout {
  id: string;
  workout_name: string;
  video_url?: string;
  notes?: string;
  exercises?: Exercise[];
}

interface Exercise {
  type?: string;
  name?: string;
  video_url?: string;
  met?: number;
  MET?: number;
  order?: number;
  durationSec?: number;
  restSec?: number;
  reps?: number;
  style?: string;
}

/** Firestore `in` queries accept max 30 items. */
function chunk<T>(arr: T[], size = 30): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Calculate current week range (Mon-Sun)
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const mondayTS = Timestamp.fromDate(monday);
    const sundayTS = Timestamp.fromDate(sunday);

    // --- Workouts for this week (using `date` Timestamp)
    const workoutsSnap = await firestore
      .collection("workouts")
      .where("date", ">=", mondayTS)
      .where("date", "<=", sundayTS)
      .get();

    if (workoutsSnap.empty) {
      res.setHeader("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
      return res.status(200).json({ weekStart: monday.toISOString(), workouts: [] });
    }

    // Map workouts with the fields you use everywhere
    const Ws: Workout[] = workoutsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.workout_id,
        workout_name: data.workout_name,
        video_url: data.video_url || "",
        notes: data.notes || "",
      };
    });

    // --- Fetch exercises for these workouts
    const workoutIds = Ws.map((w) => w.id).filter(Boolean);
    let allExercises: any[] = [];

    if (workoutIds.length > 0) {
      const idChunks = chunk(workoutIds, 30);
      const chunkSnaps = await Promise.all(
        idChunks.map((ids) =>
          firestore
            .collection("workoutExercises")
            .where("workout_id", "in", ids)
            .get()
        )
      );

      for (const snap of chunkSnaps) {
        allExercises.push(...snap.docs.map((d) => d.data()));
      }
    }

    // Attach exercises to workouts
    const workouts: Workout[] = Ws.map((w) => {
      const exs = allExercises
        .filter((e) => e.workout_id === w.id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((e): Exercise => ({
          type: e.type,
          name: e.name || e.exercise_name,
          video_url: e.video_url || e.VideoURL || "",
          met: e.met ?? e.MET,
          MET: e.MET,
          order: e.order,
          durationSec: e.durationSec,
          restSec: e.restSec,
          reps: e.reps,
          style: e.style,
        }));

      return { ...w, exercises: exs };
    });

    res.setHeader("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    return res.status(200).json({ weekStart: monday.toISOString(), workouts });
  } catch (err: any) {
    console.error("API /workouts failed:", err?.message || err);
    return res.status(500).json({ error: "Failed to load workouts" });
  }
}
