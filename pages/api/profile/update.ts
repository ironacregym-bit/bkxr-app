
// pages/api/profile/update.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getSheetsClient, readRange, updateRowByKey } from "../../../lib/sheets";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, ...fields } = req.body as Record<string, any>;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email required" });
  }

  try {
    // Ensure client is initialised (kept for parity with your current code)
    await getSheetsClient();

    const range = "Users!A:L"; // header row + data rows
    const rows = await readRange(range);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Users sheet is empty" });
    }

    const headerRow = rows[0];
    const headers = headerRow.map((h: any) => String(h ?? "").trim());
    const headerIndexMap = new Map<string, number>();
    headers.forEach((h: string, i: number) => headerIndexMap.set(h.toLowerCase(), i));

    // Find the row by email (email assumed in first column)
    const idx = rows.findIndex((r: any[], i: number) => i > 0 && String(r[0] ?? "").trim() === email.trim());
    if (idx === -1) {
      return res.status(404).json({ error: "Profile not found" });
    }

    // Build updates: only skip keys that are truly undefined;
    // write empty strings/zero/false if provided.
    const updates: Record<number, string> = {};

    const toCellString = (v: any): string => {
      if (v === null) return ""; // write empty to clear
      if (v instanceof Date) return v.toISOString();
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
      if (typeof v === "boolean") return v ? "true" : "false";
      if (typeof v === "string") return v;
      // JSON-stringify objects (e.g., equipment/preferences) into a single cell if header exists
      try {
        return JSON.stringify(v);
      } catch {
        return String(v ?? "");
      }
    };

    // Map incoming fields to sheet columns (case-insensitive header match)
    Object.entries(fields).forEach(([key, value]) => {
      if (value === undefined) return; // only skip truly undefined
      const colIdx = headerIndexMap.get(String(key).toLowerCase().trim());
      if (colIdx !== undefined) {
        updates[colIdx] = toCellString(value);
      }
    });

    // Optional: update last_login_at if present in header
    const lli = headerIndexMap.get("last_login_at");
    if (lli !== undefined && updates[lli] === undefined) {
      updates[lli] = new Date().toISOString();
    }

    // If nothing to update, return OK (no-op)
    if (Object.keys(updates).length === 0) {
      return res.status(200).json({ ok: true, message: "No matching headers to update" });
    }

    // updateRowByKey(sheetName, rowNumber, { colIndex: value })
    // NOTE: rows[] includes header at index 0; sheet row numbers are 1-based.
    // idx is data-row index in rows[], so sheet row is idx + 1.
    await updateRowByKey("Users", idx + 1, updates);

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("Update failed:", err?.message || err);
    return res.status(500).json({ error: "Failed to update profile" });
  }
}
