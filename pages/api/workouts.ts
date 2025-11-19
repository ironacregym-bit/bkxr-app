// pages/api/workouts.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { batchGet } from "../../lib/sheets";
import { startOfWeek, formatISO } from "date-fns";

type Matrix = string[][];
type WorkoutRow = {
  id: string; day: string; title: string; video?: string; notes?: string;
};
type ExerciseRow = { type?: string; name?: string; video?: string };

const headerIndex = (headerRow: string[] | undefined) =>
  headerRow ? Object.fromEntries(headerRow.map((h, i) => [h, i])) as Record<string, number> : {};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Compute "this week" starting Monday (ISO yyyy-mm-dd)
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekISO = formatISO(monday, { representation: "date" });

    // Expect batchGet to return each range as a string matrix (string[][])
    const [workoutsMat, exercisesMat] = await batchGet([
      "Workouts!A:G",   // WorkoutID | WeekStart | DayName | Title | VideoURL | Focus | Notes
      "Exercises!A:G",  // ExerciseID | WorkoutID | Seq | Type | Name | VideoURL
    ]);

    // Guard: missing/empty sheets → no workouts
    if (!Array.isArray(workoutsMat) || workoutsMat.length === 0) {
      return res.json({ weekStart: weekISO, workouts: [] });
    }
    // Exercises can be empty; still return workouts without items
    const safeExercisesMat: Matrix = Array.isArray(exercisesMat) ? exercisesMat : [];

    // Build header indices safely
    const wHdr = headerIndex(workoutsMat[0]);
    const eHdr = safeExercisesMat.length ? headerIndex(safeExercisesMat[0]) : {};

    // Verify required columns exist in Workouts
    const requiredW = ["WorkoutID", "WeekStart", "DayName", "Title", "VideoURL", "Notes"];
    const missingW = requiredW.filter(k => wHdr[k] === undefined);
    if (missingW.length) {
      console.error("Workouts header missing:", missingW.join(", "));
      return res.status(500).json({ error: "WORKOUTS_HEADERS_MISSING", missing: missingW });
    }

    // Slice to data rows
    const wRows = (workoutsMat as Matrix).slice(1);
    const eRows = (safeExercisesMat as Matrix).slice(1);

    // Filter workouts for this week
    const Ws: WorkoutRow[] = wRows
      .filter(r => r[wHdr["WeekStart"]] === weekISO)
      .map(r => ({
        id: r[wHdr["WorkoutID"]],
        day: r[wHdr["DayName"]],
        title: r[wHdr["Title"]],
        video: r[wHdr["VideoURL"]],
        notes: r[wHdr["Notes"]],
      }))
      // guard against malformed rows
      .filter(w => !!w.id && !!w.day && !!w.title);

    // If no exercises header, return workouts without exercises
    if (!safeExercisesMat.length || Object.keys(eHdr).length === 0) {
      return res.json({ weekStart: weekISO, workouts: Ws.map(w => ({ ...w, exercises: [] })) });
    }

    // Verify required exercise columns exist
    const requiredE = ["WorkoutID", "Seq", "Type", "Name", "VideoURL"];
    const missingE = requiredE.filter(k => eHdr[k] === undefined);
    if (missingE.length) {
      console.warn("Exercises header missing:", missingE.join(", "));
      // Still return workouts without exercises rather than 500
      return res.json({ weekStart: weekISO, workouts: Ws.map(w => ({ ...w, exercises: [] })) });
    }

    // Attach exercises to each workout
    const workouts = Ws.map(w => {
      const items: ExerciseRow[] = eRows
        .filter(e => e[eHdr["WorkoutID"]] === w.id)
        .sort((a, b) => Number(a[eHdr["Seq"]] ?? 0) - Number(b[eHdr["Seq"]] ?? 0))
        .map(e => ({
          type: e[eHdr["Type"]],
          name: e[eHdr["Name"]],
          video: e[eHdr["VideoURL"]],
        }));
      return { ...w, exercises: items };
    });

    return res.json({ weekStart: weekISO, workouts });
  } catch (err: any) {
    console.error("API /workouts failed:", err?.message || err, err);
    return res.status(500).json({ error: "WORKOUTS_FETCH_FAILED", detail: String(err?.message || err) });}
