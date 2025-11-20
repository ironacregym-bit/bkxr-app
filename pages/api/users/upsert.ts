import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { readRange, appendRow, updateRowByKey } from "../../../lib/sheets";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Validate session
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ ok: false, error: "UNAUTHENTICATED" });
  }

  // Extract user data from request body
  const { email, name = "", image = "" } = req.body || {};
  if (!email || typeof email !== "string") {
    return res.status(400).json({ ok: false, error: "INVALID_EMAIL" });
  }

  try {
    const range = "Users!A:G"; // email | name | image | created_at | last_login_at | calorie_target | weight_kg | bodyfat_pct
    const rows = await readRange(range); // uses your helper (range only)
    const idx = rows.findIndex(r => (r[0] || "").toLowerCase() === email.toLowerCase());

    const nowIso = new Date().toISOString();

    if (idx === -1) {
      // New user → append row
      await appendRow(range, [email, name, image, nowIso, nowIso, "", "", ""]);
    } else {
      // Existing user → update name, image, last_login_at
      const rowNumber = idx + 1; // 1-based index
      await updateRowByKey("Users", rowNumber, {
        1: name,       // column B
        2: image,      // column C
        4: nowIso      // column E (last_login_at)
      });
    }

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({
      ok: false,
      error: "USER_UPSERT_FAILED",
      detail: e?.message
    });
  }
}
