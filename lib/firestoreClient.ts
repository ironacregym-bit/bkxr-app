import { Firestore } from "@google-cloud/firestore";
// Normalize private key from Vercel env (convert escaped \n to real newlines)
function normalizeKey(key?: string): string {
  if (!key) return '';
  return key
    .replace(/\\n/g, '\n')          // convert escaped newlines
    .replace(/^"+|"+$/g, '')        // remove accidental quotes
    .trim();
}
const firestore = new Firestore({
  projectId: process.env.GOOGLE_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_ID,
    private_key: normalizeKey(process.env.GOOGLE_PRIVATE_KEY),
  },
});

export default firestore;
