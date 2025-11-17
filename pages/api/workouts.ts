// pages/api/workouts.ts
import { NextApiRequest, NextApiResponse } from "next";
import { batchGet } from "../../lib/sheets";
import { startOfWeek, formatISO } from "date-fns";

type Matrix = string[][];
const indexMap = (headerRow: string[]) =>
  Object.fromEntries(headerRow.map((h, i) => [h, i])) as Record<string, number>;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekISO = formatISO(monday, { representation: "date" });

  // Get both ranges as matrices
  const [workoutsMat, exercisesMat] = await batchGet(["Workouts!A:G", "Exercises!A:G"]);

  // Guard for missing sheets / empty
  if (!workoutsMat.length || !exercisesMat.length) {
    return res.json({ weekStart: weekISO, workouts: [] });
  }

  // Header indices
  const wHdr = indexMap(workoutsMat[0]);
  const eHdr = indexMap(exercisesMat[0]);

  // Data rows
  const wRows = (workoutsMat as Matrix).slice(1);
  const eRows = (exercisesMat as Matrix).slice(1);

  // Filter to this week
  const Ws = wRows
    .filter(r => r[wHdr["WeekStart"]] === weekISO)
    .map(r => ({
      id: r[wHdr["WorkoutID"]],
      day: r[wHdr["DayName"]],
      title: r[wHdr["Title"]],
      video: r[wHdr["VideoURL"]],
      notes: r[wHdr["Notes"]]
    }));

  // Join exercises
  const workouts = Ws.map(w => ({
    ...w,
    exercises: eRows
      .filter(e => e[eHdr["WorkoutID"]] === w.id)
      .sort((a, b) => Number(a[eHdr["Seq"]]) - Number(b[eHdr["Seq"]]))
      .map(e => ({
        type: e[eHdr["Type"]],
        name: e[eHdr["Name"]],
        video: e[eHdr["VideoURL"]]
      }))
  }));

  res.json({ weekStart: weekISO, workouts });
}
