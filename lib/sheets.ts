// /lib/sheets.ts
import { google } from "googleapis";

function normalizeKey(k?: string) {
  if (!k) return "";
  // Convert \r\n or \\n into actual newlines and trim any accidental quotes/whitespace
  const cleaned = k.replace(/\r\\n|\\r\\n/g, "\n").replace(/\\n/g, "\n").trim();
  // Strip wrapping quotes if someone pasted with them
  return cleaned.replace(/^"+|"+$/g, "");
}

const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n');
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;

if (!PRIVATE_KEY.includes("BEGIN PRIVATE KEY") || !PRIVATE_KEY.endsWith("-----END PRIVATE KEY-----\n")) {
  // Log minimal hint; do not log the key content
  console.error("GOOGLE_PRIVATE_KEY invalid format (missing BEGIN/END or newlines).");
}

const auth = new google.auth.JWT(
  CLIENT_EMAIL,
  undefined,
  PRIVATE_KEY,
  ["https://www.googleapis.com/auth/spreadsheets"]
);

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!;

export async function readRange(range: string) {
  const { data } = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range });
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

export async function batchGet(ranges: string[]) {
  const { data } = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges
  });
  const vr = data.valueRanges ?? [];
  return vr.map(v => (v.values ?? [])) as string[][][]; // matrices
}
