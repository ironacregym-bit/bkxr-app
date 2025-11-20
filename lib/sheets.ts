// lib/sheets.ts
import { google, sheets_v4 } from 'googleapis';

// Normalize private key from Vercel env (convert escaped \n to real newlines)
function normalizeKey(key?: string): string {
  if (!key) return '';
  return key
    .replace(/\\n/g, '\n')          // convert escaped newlines
    .replace(/^"+|"+$/g, '')        // remove accidental quotes
    .trim();
}

// Load and validate environment variables
const CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const PRIVATE_KEY = normalizeKey(process.env.GOOGLE_PRIVATE_KEY);
const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID;

if (!CLIENT_EMAIL || !PRIVATE_KEY || !SPREADSHEET_ID) {
  throw new Error('Missing Google Sheets environment variables');
}

// Debug: Check first few lines of the key (safe preview)
console.log('PRIVATE_KEY preview:', PRIVATE_KEY.split('\n').slice(0, 3));

if (!PRIVATE_KEY.includes('BEGIN PRIVATE KEY') || !PRIVATE_KEY.includes('END PRIVATE KEY')) {
  console.error('GOOGLE_PRIVATE_KEY format looks invalid (missing BEGIN/END markers).');
}

// --- Client initialisation (singleton) ---
const auth = new google.auth.JWT(
  CLIENT_EMAIL,
  undefined,
  PRIVATE_KEY,
  ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets = google.sheets({ version: 'v4', auth });

/**
 * Optional: getSheetsClient()
 * Returns the same Sheets client (JWT already created above). Kept for API convenience.
 */
export async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  // Ensure the JWT has a valid token before use (safe to call multiple times)
  await auth.authorize().catch(() => {/* ignore re-authorise errors; JWT refreshes internally */});
  return sheets;
}

// --- Existing helpers (retained) ---

// Read a range from the spreadsheet (values array only)
export async function readRange(range: string): Promise<string[][]> {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return (data.values ?? []) as string[][];
}

// Append a row to the spreadsheet
export async function appendRow(range: string, values: any[]): Promise<void> {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

// Batch get multiple ranges (values arrays only)
export async function batchGet(ranges: string[]): Promise<string[][][]> {
  const { data } = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges,
  });
  const vr = data.valueRanges ?? [];
  return vr.map(v => (v.values ?? [])) as string[][][];
}

// --- New helpers (added) ---

/**
 * readRangeData(range): returns the full Google API response for the range,
 * useful when you want headers, range string, etc. alongside values.
 */
export async function readRangeData(range: string) {
  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range,
  });
  return data; // { range, majorDimension, values }
}

/**
 * updateRowByKey(sheetName, rowNumber, updates)
 * Efficiently updates specific columns in a single row using batchUpdate.
 * - sheetName: e.g. "Users"
 * - rowNumber: 1-based row index in that sheet (including header row)
 * - updates: Record<columnIndex, string> where columnIndex is 0 for column A, 1 for B, etc.
 *
 * Example:
 *   await updateRowByKey("Users", 5, { 1: "New Name", 2: "https://img", 4: new Date().toISOString() });
 */
export async function updateRowByKey(
  sheetName: string,
  rowNumber: number,
  updates: Record<number, string>
): Promise<void> {
  // Build per-cell ranges for the specified columns
  const data: sheets_v4.Schema$ValueRange[] = Object.entries(updates).map(([colIdxStr, value]) => {
    const colIdx = Number(colIdxStr);
    // Convert 0 -> 'A', 1 -> 'B', ... 25 -> 'Z', 26 -> 'AA', etc.
    const colLetter = indexToColumnLetter(colIdx);
    return {
      range: `${sheetName}!${colLetter}${rowNumber}:${colLetter}${rowNumber}`,
      values: [[value]],
      majorDimension: 'ROWS'
    };
  });

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data
    }
  });
}

// --- Utility: index -> column letters (supports AA, AB...) ---
function indexToColumnLetter(index: number): string {
  let i = index;
  let letters = '';
  while (i >= 0) {
    letters = String.fromCharCode((i % 26) + 65) + letters;
    i = Math.floor(i / 26) - 1;
  }
  return letters;
}
