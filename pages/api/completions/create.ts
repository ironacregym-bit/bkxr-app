import type { NextApiRequest, NextApiResponse } from "next";
import { appendRow } from "../../../lib/sheets";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { user_email, workout_id, started_at, completed_at, calories_burned, notes } = req.body;

  if (!user_email || !workout_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await appendRow("Completions!A:F", [
      user_email,
      workout_id,
      started_at || new Date().toISOString(),
      completed_at || new Date().toISOString(),
      calories_burned || "",
      notes || "",
    ]);

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("Completion logging failed:", err.message);
    return res.status(500).json({ error: "Failed to log completion" });
  }
}
