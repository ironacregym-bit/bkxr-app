// pages/api/users/upsert.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { readRange, appendRow, updateRowByKey } from "../../../lib/sheets";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ ok: false, error: "UNAUTHENTICATED" });

  const { email, name = "", image = "" } = req.body || {};
  if (!email || typeof email !== "string") return res.status(400).json({ ok: false, error: "INVALID_EMAIL" });

  try {
    const range = "Users!A:G"; // email | name | image | created_at | last_login_at | calorie_target | weight_kg | bodyfat_pct
    const rows = await readRange(range); // ✅ only pass range now
    const idx = rows.findIndex(r => (r[0] || "").toLowerCase() === email.toLowerCase());

    const nowIso = new Date().toISOString();
    if (idx === -1) {
      await appendRow("Users!A:G", [email, name, image, nowIso, nowIso, "", "", ""]);
    } else {
      const rowNumber = idx + 1; // 1-based
      await updateRowByKey("Users", rowNumber, { 1: name, 2: image, 4: nowIso }); 
      // columns: 0=email, 1=name, 2=image, 4=last_login_at
    }

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: "USER_UPSERT_FAILED", detail: e?.message });
  }
