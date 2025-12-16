
// pages/api/workouts.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { startOfWeek } from "date-fns";
import { Timestamp } from "@google-cloud/firestore";
import firestore from "../../lib/firestoreClient";

/**
 * Legacy 'Exercise' row shape for workoutExercises join.
 */
interface Exercise {
  type?: string;
  name?: string;
  video_url?: string;
  met?: number;
  MET?: number;
  order?: number;
  durationSec?: number;
  restSec?: number;
  reps?: number | string;
  style?: string;
}

/**
 * New 'Rounds' shape for workouts/{id}/rounds/{roundId}/items/{itemId}.
 */
interface BoxingAction {
  kind: "punch" | "defence";
  code: string;
  count?: number;
  tempo?: string;
  notes?: string;
}
interface ExerciseItemOut {
  item_id: string;
  type: "Boxing" | "Kettlebell";
  style?: "EMOM" | "AMRAP" | "LADDER" | "Combo";
  order: number;
  // Boxing
  duration_s?: number;
  combo?: {
    name?: string;
    actions: BoxingAction[];
    notes?: string;
  };
  // KB
  exercise_id?: string;
  reps?: string;
  time_s?: number;
  weight_kg?: number;
  tempo?: string;
  rest_s?: number;
}
interface RoundOut {
  round_id: string;
  name: string;
  order: number;
  category: "Boxing" | "Kettlebell";
  style?: "EMOM" | "AMRAP" | "LADDER";
  duration_s?: number;
  is_benchmark_component?: boolean;
  items: ExerciseItemOut[];
}
interface Workout {
  id: string;
  workout_name: string;
  video_url?: string;
  notes?: string;
  focus?: string;
  is_benchmark?: boolean;
  benchmark_name?: string;
  // Either legacy exercises OR new rounds
  exercises?: Exercise[];
  rounds?: RoundOut[];
}

/** Firestore `in` queries accept max 30 items. */
function chunk<T>(arr: T[], size = 30): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Week range (Mon-Sun)
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const mondayTS = Timestamp.fromDate(monday);
    const sundayTS = Timestamp.fromDate(sunday);

    // Workouts scheduled within the week (by 'date' field)
    const workoutsSnap = await firestore
      .collection("workouts")
      .where("date", ">=", mondayTS)
      .where("date", "<=", sundayTS)
      .get();

    // If none, return empty
    if (workoutsSnap.empty) {
      res.setHeader("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
      return res.status(200).json({ weekStart: monday.toISOString(), workouts: [] });
    }

    // Base workout rows (prefer doc.id if workout_id missing)
    const baseWorkouts: Workout[] = workoutsSnap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.workout_id || doc.id,
        workout_name: data.workout_name || "",
        video_url: data.video_url || "",
        notes: data.notes || "",
        focus: data.focus || "",
        is_benchmark: !!data.is_benchmark,
        benchmark_name: data.benchmark_name || "",
      };
    });

    // For legacy shape: collect IDs to join with workoutExercises
    const workoutIds = baseWorkouts.map((w) => w.id).filter(Boolean);

    // ---- NEW SHAPE: rounds hydration per workout
    // We’ll fetch rounds/items for each workout; if rounds exist, we attach them.
    const workoutsWithRounds: Record<string, RoundOut[]> = {};

    for (const w of baseWorkouts) {
      const roundsRef = firestore.collection("workouts").doc(w.id).collection("rounds");
      const roundsSnap = await roundsRef.orderBy("order").get();

      if (!roundsSnap.empty) {
        const roundsOut: RoundOut[] = [];
        for (const rDoc of roundsSnap.docs) {
          const r = rDoc.data() as any;
          const itemsSnap = await rDoc.ref.collection("items").orderBy("order").get();

          const items: ExerciseItemOut[] = itemsSnap.docs.map((d) => {
            const i = d.data() as any;
            const out: ExerciseItemOut = {
              item_id: d.id,
              type: i.type,
              order: i.order,
            };
            if (i.type === "Boxing") {
              out.style = "Combo";
              out.duration_s = i.duration_s ?? r.duration_s ?? 180;
              out.combo = i.combo;
            } else {
              out.style = i.style ?? r.style;
              out.exercise_id = i.exercise_id;
              out.reps = i.reps ?? undefined;
              out.time_s = i.time_s ?? undefined;
              out.weight_kg = i.weight_kg ?? undefined;
              out.tempo = i.tempo ?? undefined;
              out.rest_s = i.rest_s ?? undefined;
            }
            return out;
          });

          roundsOut.push({
            round_id: rDoc.id,
            name: r.name || "",
            order: r.order ?? 0,
            category: r.category as "Boxing" | "Kettlebell",
            style: r.style,
            duration_s: r.duration_s ?? (r.category === "Boxing" ? 180 : undefined),
            is_benchmark_component: !!r.is_benchmark_component,
            items,
          });
        }
        workoutsWithRounds[w.id] = roundsOut;
      }
    }

    // ---- LEGACY SHAPE: workoutExercises join (only where rounds were not found)
    let allExercises: any[] = [];
    const legacyIds = baseWorkouts.filter((w) => !workoutsWithRounds[w.id]).map((w) => w.id);

    if (legacyIds.length > 0) {
      const idChunks = chunk(legacyIds, 30);
      const chunkSnaps = await Promise.all(
        idChunks.map((ids) =>
          firestore.collection("workoutExercises").where("workout_id", "in", ids).get()
        )
      );
      for (const snap of chunkSnaps) {
        allExercises.push(...snap.docs.map((d) => d.data()));
      }
    }

    // Attach either rounds or exercises to each workout
    const workouts: Workout[] = baseWorkouts.map((w) => {
      const rounds = workoutsWithRounds[w.id];
      if (rounds && rounds.length) {
        return { ...w, rounds };
      }
      // legacy fallback
      const exs: Exercise[] = allExercises
        .filter((e) => e.workout_id === w.id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((e) => ({
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

