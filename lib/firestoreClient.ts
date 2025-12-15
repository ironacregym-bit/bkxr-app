
// lib/firestoreClient.ts
import { Firestore, Timestamp, FieldValue } from "@google-cloud/firestore";

// Normalize private key from Vercel env (convert escaped \n to real newlines)
function normalizeKey(key?: string): string {
  if (!key) return '';
  return key
    .replace(/\\n/g, '\n')    .replace(/\\n/g, '\n')          // convert escaped newlines
    .replace(/^"+|"+$/g, '')        // remove accidental quotes
    .trim();
}

const firestore = new Firestore({
  projectId: process.env.GOOGLE_PROJECT_ID, // e.g., "my-firestore-project"
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL, // ✅ correct env var
    private_key: normalizeKey(process.env.GOOGLE_PRIVATE_KEY),
  },
});

export default firestore;
// Convenience exports if you need them elsewhere

