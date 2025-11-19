// pages/api/health.ts
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
    console.error("API /health failed:", err?.message || err);
    return res.status(200).json({
      ok: false,
      settingsRows: 0,
      env: {
        SHEETS_SPREADSHEET_ID: !!process.env.SHEETS_SPREADSHEET_ID,
        GOOGLE_CLIENT_EMAIL: !!process.env.GOOGLE_CLIENT_EMAIL,
        GOOGLE_PRIVATE_KEY: !!process.env.GOOGLE_PRIVATE_KEY,
        NEXTAUTH_URL: !!process.env.NEXTAUTH_URL
      },
      error: String(err?.message || err)
    });
  }
}
// Debug: Check if newlines are real
console.log('PRIVATE_KEY preview:', PRIVATE_KEY.slice(0, 80));
