// pages/api/completions/create.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { appendRow } from "../../../lib/sheets";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { user_email, workout_id, calories_burned, notes } = req.body || {};
  if (!user_email || !workout_id) {
    return res.status(400).json({ ok: false, error: "INVALID_INPUT" });
  }
  try {
    await appendRow("Completions!A:F", [
      user_email,
      workout_id,
      new Date().toISOString(), // started_at (MVP: same timestamp)
      new Date().toISOString(), // completed_at
      calories_burned ?? "",
      notes ?? ""
    ]);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "COMPLETE_FAILED", detail: e?.message });
  }
}
