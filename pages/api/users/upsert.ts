// pages/api/users/upsert.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]"; // adjust path if different
import { getSheetsClient, readRange, appendRow, updateRowByKey } from "../../../lib/sheets";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ ok: false, error: "UNAUTHENTICATED" });

  const { email, name = "", image = "" } = req.body || {};
  if (!email || typeof email !== "string") return res.status(400).json({ ok: false, error: "INVALID_EMAIL" });

  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID!;
    const range = "Users!A:G"; // email | name | image | created_at | last_login_at | calorie_target | weight_kg | bodyfat_pct
    const resp = await readRange(sheets, spreadsheetId, range);
    const rows = resp.values || [];
    const idx = rows.findIndex(r => (r[0] || "").toLowerCase() === email.toLowerCase());

    const nowIso = new Date().toISOString();
    if (idx === -1) {
      await appendRow(sheets, spreadsheetId, "Users", [email, name, image, nowIso, nowIso, "", "", ""]);
    } else {
      const rowNumber = idx + 1; // 1-based
      await updateRowByKey(sheets, spreadsheetId, "Users", rowNumber, { 2: name, 3: image, 5: nowIso }); // 0=email, 1=name, 2=image, 4=created_at, 5=last_login_at
    }

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "USER_UPSERT_FAILED", detail: e?.message });
  }
}
