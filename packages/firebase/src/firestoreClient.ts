// File: lib/firestoreClient.ts
import { Firestore } from "@google-cloud/firestore";

// Normalise private key from Vercel env (convert escaped \\n to real newlines, strip accidental quotes)
function normalizeKey(key?: string): string {
  if (!key) return "";
  return key.replace(/\\n/g, "\n").replace(/^"+|"+$/g, "").trim();
}

const projectId =
  process.env.GOOGLE_PROJECT_ID ||
  process.env.FIREBASE_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT;
const clientEmail =
  process.env.GOOGLE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = normalizeKey(
  process.env.GOOGLE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY
);
const credentials =
  clientEmail && privateKey
    ? { client_email: clientEmail, private_key: privateKey }
    : undefined;

const firestore = new Firestore({
  projectId,
  ...(credentials ? { credentials } : {}),
});

// Prevent undefined properties from being sent (safer merges)
firestore.settings({ ignoreUndefinedProperties: true });

// Optional: one-time log to confirm runtime project (remove after validation)
if (process.env.NODE_ENV !== "production") {
  // Do NOT log the private key. Project ID is safe.
  // eslint-disable-next-line no-console
  console.log("[IronAcre] Firestore project:", process.env.GOOGLE_PROJECT_ID);
}

export default firestore;
