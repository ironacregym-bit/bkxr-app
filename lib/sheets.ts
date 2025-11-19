import { google } from 'googleapis';

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

// Initialize Google Sheets API client
const auth = new google.auth.JWT(
  CLIENT_EMAIL,
  undefined,
  PRIVATE_KEY,
  ['https://www.googleapis.com/auth/spreadsheets']
);

const sheets = google.sheets({ version: 'v4', auth });

// Read a range from the spreadsheet
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

// Batch get multiple ranges
export async function batchGet(ranges: string[]): Promise<string[][][]> {
  const { data } = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges,
  });
  const vr = data.valueRanges ?? [];
  return vr.map(v => (v.values ?? [])) as string[][][];
}
