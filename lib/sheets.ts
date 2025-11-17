// lib/sheets.ts
import { google } from "googleapis";

const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  undefined,
  (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/spreadsheets"]
);
const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!;

export async function readRange(range: string) {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range
  });
  return (data.values ?? []) as string[][];
}

export async function appendRow(range: string, values: any[]) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] }
  });
}

/**
 * Return each requested range as a plain matrix (string[][]).
 * Missing ranges come back as [] so callers can guard easily.
 */
export async function batchGet(ranges: string[]) {
  const { data } = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges
  });
  const vr = data.valueRanges ?? [];
  // Map to string[][], defaulting to empty array for missing data
  return vr.map(v => (v.values ?? [])) as string[][][];
}
