// pages/api/profile.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { readRange } from "../../lib/sheets";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const email = req.query.email as string;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const rows = await readRange("Users!A:L");
    const headers = rows[0];
    const row = rows.find((r) => r[0] === email);

    if (!row) return res.status(404).json({ error: "Profile not found" });

    // Convert row to object { header: value }
    const profile: Record<string, string> = {};
    headers.forEach((h, i) => (profile[h] = row[i] || ""));
    return res.status(200).json(profile);
  } catch (err: any) {
    console.error("Read failed:", err.message);
    return res.status(500).json({ error: "Failed to load profile" });
  }
}
