import { NextApiRequest, NextApiResponse } from "next";
import { batchGet } from "../../lib/sheets";
import { startOfWeek, formatISO } from "date-fns";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekISO = formatISO(monday, { representation: "date" });
  const [wR, eR] = await batchGet(["Workouts!A:G", "Exercises!A:G"]);
  if (!wR[0]?.values || !eR[0]?.values) return res.json({ weekStart: weekISO, workouts: [] });

  const idx = (row0: string[]) => Object.fromEntries(row0.map((h, i) => [h, i]));
  const wH = idx(wR[0].values[0] as string[]);
  const eH = idx(eR[0].values[0] as string[]);

  const W = (wR[0].values as string[][]).slice(1)
    .filter(r => r[wH["WeekStart"]] === weekISO)
    .map(r => ({ id: r[wH["WorkoutID"]], day: r[wH["DayName"]], title: r[wH["Title"]], video: r[wH["VideoURL"]], notes: r[wH["Notes"]] }));

  const E = (eR[0].values as string[][]).slice(1);

  const workouts = W.map(w => ({
    ...w,
    exercises: E.filter(e => e[eH["WorkoutID"]] === w.id)
      .sort((a, b) => Number(a[eH["Seq"]]) - Number(b[eH["Seq"]]))
      .map(e => ({ type: e[eH["Type"]], name: e[eH["Name"]], video: e[eH["VideoURL"]] }))
  }));
  res.json({ weekStart: weekISO, workouts });
}
