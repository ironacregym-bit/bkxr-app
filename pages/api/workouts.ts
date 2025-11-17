// /pages/api/workouts.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { batchGet } from "../../lib/sheets";
import { startOfWeek, formatISO } from "date-fns";

type Row = string[];

// Build a header index: header -> column number
function headerIndex(row0: Row | undefined) {
  if (!row0) return {} as Record<string, number>;
  return Object.fromEntries(row0.map((h, i) => [h, i])) as Record<string, number>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekISO = formatISO(monday, { representation: "date" });

    // Get both sheets in one call
    const valueRanges = await batchGet(["Workouts!A:G", "Exercises!A:G"]);

    // valueRanges[0] -> Workouts, valueRanges[1] -> Exercises (order matches input)
    const workoutsVR = valueRanges[0];
    const exercisesVR = valueRanges[1];

    const workoutsValues: Row[] = (workoutsVR?.values as Row[]) ?? [];
    const exercisesValues: Row[] = (exercisesVR?.values as Row[]) ?? [];

    if (workoutsValues.length === 0) {
      return res.json({ weekStart: weekISO, workouts: [] });
    }

    const wH = headerIndex(workoutsValues[0]);
    const eH = headerIndex(exercisesValues[0]);

    // Data rows (skip header)
    const W = workoutsValues.slice(1);
    const E = exercisesValues.length > 0 ? exercisesValues.slice(1) : [];

    // Filter to this week
    const weekWorkouts = W.filter(r => r[wH["WeekStart"]] === weekISO).map(r => ({
      id: r[wH["WorkoutID"]],
      day: r[wH["DayName"]],
      title: r[wH["Title"]],
      video: r[wH["VideoURL"]],
      notes: r[wH["Notes"]],
    }));

    // Attach exercises per workout
    const workouts = weekWorkouts.map(w => {
      const items = E
        .filter(e => e[eH["WorkoutID"]] === w.id)
        .sort((a, b) => Number(a[eH["Seq"]] ?? 0) - Number(b[eH["Seq"]] ?? 0))
        .map(e => ({
          type: e[eH["Type"]],
          name: e[eH["Name"]],
          video: e[eH["VideoURL"]],
        }));
      return { ...w, exercises: items };
    });

    res.json({ weekStart: weekISO, workouts });
  } catch (err: any) {
    console.error("API /workouts error:", err?.message || err);
    res.status(500).json({ error: "Unable to fetch workouts" });
  }
}
