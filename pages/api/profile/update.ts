import type { NextApiRequest, NextApiResponse } from "next";
import { getSheetsClient, readRange, updateRowByKey } from "../../lib/sheets";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, ...fields } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  try {
    const sheets = await getSheetsClient();
    const range = "Users!A:L";

    // Read all rows
    const rows = await readRange(range);
    const headers = rows[0];
    const idx = rows.findIndex((r) => r[0] === email);

    if (idx === -1) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Build updates: map header names to column indexes
    const updates: Record<number, string> = {};
    headers.forEach((h, i) => {
      if (fields[h]) {
        updates[i] = fields[h];
      }
    });

    // Update only changed cells
    await updateRowByKey("Users", idx + 1, updates);

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("Update failed:", err.message);
    return res.status(500).json({ error: "Failed to update profile" });
  }
}
