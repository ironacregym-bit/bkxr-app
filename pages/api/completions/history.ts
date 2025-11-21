import type { NextApiRequest, NextApiResponse } from "next";
import { readRange } from "../../../lib/sheets";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const rows = await readRange("Completions!A:F");
    const headers = rows[0];
    const userRows = rows.filter((r) => r[0] === email);

    const history = userRows.map((r) => ({
      workout_id: r[1],
      started_at: r[2],
      completed_at: r[3],
      calories_burned: r[4],
      notes: r[5],
    }));

    return res.status(200).json({ history });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch completion history" });
  }
}
