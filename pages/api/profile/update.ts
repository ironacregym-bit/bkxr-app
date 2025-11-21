import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, ...fields } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL!,
        private_key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID!;
    const range = "Users!A:L";

    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values || [];
    const headers = rows[0];
    const idx = rows.findIndex((r) => r[0] === email);

    if (idx === -1) return res.status(404).json({ error: "Profile not found" });

    // Update row with new values
    const updatedRow = headers.map((h) => fields[h] || rows[idx][headers.indexOf(h)] || "");
    updatedRow[0] = email; // Ensure email stays
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Users!A${idx + 1}:L${idx + 1}`,
      valueInputOption: "RAW",
      requestBody: { values: [updatedRow] },
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update profile" });
  }
}
