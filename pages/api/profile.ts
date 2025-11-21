import { google } from "googleapis";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Profile!A:K", // Adjust range to your sheet
    });

    const rows = response.data.values || [];
    const headers = rows[0];
    const userRow = rows.find((r) => r[0] === email); // Assuming email is first column

    if (!userRow) return res.status(404).json({ error: "Profile not found" });

    const profileData = headers.reduce((obj, header, i) => {
      obj[header] = userRow[i] || "";
      return obj;
    }, {} as Record<string, string>);

    res.status(200).json(profileData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
}
