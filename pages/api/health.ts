// pages/api/health.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { readRange } from "../../lib/sheets";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // simple Sheets read proves SA key + share perms + env are correct
    const settings = await readRange("Settings!A:B");
    return res.status(200).json({
      ok: true,
      settingsRows: settings?.length ?? 0,
      env: {
        SHEETS_SPREADSHEET_ID: Boolean(process.env.SHEETS_SPREADSHEET_ID),
        GOOGLE_CLIENT_EMAIL: Boolean(process.env.GOOGLE_CLIENT_EMAIL),
        GOOGLE_PRIVATE_KEY: Boolean(process.env.GOOGLE_PRIVATE_KEY),
        NEXTAUTH_URL: Boolean(process.env.NEXTAUTH_URL),
      }
    });
  } catch (err: any) {
    return res.status(500).json({ ok:false, error: String(err?.message || err) });
  }
}
