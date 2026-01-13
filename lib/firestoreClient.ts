
// lib/firestoreClient.ts
import { Firestore } from "@google-cloud/firestore";

// Normalise private key from Vercel env (convert escaped \n to real newlines, strip accidental quotes)
function normalizeKey(key?: string): string {
  if (!key) return "";
  return key.replace(/\\n/g, "\n").replace(/^"+|"+$/g, "").trim();
}

const firestore = new Firestore({
  projectId: process.env.GOOGLE_PROJECT_ID,
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: normalizeKey(process.env.GOOGLE_PRIVATE_KEY),
  },
});

// Prevent undefined properties from being sent (safer merges)
firestore.settings({ ignoreUndefinedProperties: true });

// Optional: one-time log to confirm runtime project (remove after validation)
if (process.env.NODE_ENV !== "production") {
  // Do NOT log the private key. Project ID is safe.
  console.log("[BXKR] Firestore project:", process.env.GOOGLE_PROJECT_ID);
}

export default firestore;
