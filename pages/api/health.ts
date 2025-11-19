import type { NextApiRequest, NextApiResponse } from "next";
import { readRange } from "../../lib/sheets";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const settings = await readRange("Settings!A:B");
    return res.status(200).json({
      ok: true,
      settingsRows: settings.length,
      env: {
        SHEETS_SPREADSHEET_ID: !!process.env.SHEETS_SPREADSHEET_ID,
        GOOGLE_CLIENT_EMAIL: !!process.env.GOOGLE_CLIENT_EMAIL,
        GOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY,
        NEXTAUTH_URL: !!process.env.NEXTAUTH_URL
      }
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
