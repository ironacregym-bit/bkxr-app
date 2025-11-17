import { NextApiRequest, NextApiResponse } from "next";
import { appendRow } from "../../lib/sheets";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { email, workoutId, roundsDone, durationMin, calories, rpe, notes, completed } = req.body;
  const id = crypto.randomUUID(); const dt = new Date().toISOString();
  await appendRow("Sessions!A:J", [id, email, workoutId, dt, roundsDone, durationMin, calories, rpe, notes || "", completed ? "Y" : "N"]);
  res.json({ ok: true, id });
}
