import type { NextApiRequest, NextApiResponse } from "next";
import { readRange } from "../../../lib/sheets";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { email, workout_id } = req.query;
  if (!email || !workout_id) return res.status(400).json({ error: "Missing params" });

  try {
    const rows = await readRange("Completions!A:F");
    const exists = rows.some((r) => r[0] === email && r[1] === workout_id);
    return res.status(200).json({ completed: exists });
  } catch (err) {
    console.error("Completion check failed:", err);
    return res.status(500).json({ error: "Failed to check completion" });
  }
}
