// /lib/sheets.ts
import { google, sheets_v4 } from "googleapis";

const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  undefined,
  (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/spreadsheets.readonly"] // readonly is enough here
);

const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!;

export async function batchGet(ranges: string[]) {
  const { data } = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges,
  });
  // Always return an array for convenience
  return data.valueRanges ?? [];
}

export async function readRange(range: string) {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return data.values ?? [];
}
