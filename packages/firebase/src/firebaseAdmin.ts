
// lib/firebaseAdmin.ts
import { initializeApp, cert, getApps, applicationDefault, App } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue as AdminFieldValue,
  Timestamp as AdminTimestamp,
  Firestore,
} from "firebase-admin/firestore";

/**
 * Normalise multiline private keys from env (Vercel stores \n as escaped).
 */
function normalizeKey(key?: string | null): string | undefined {
  if (!key) return undefined;
  return key.replace(/\\n/g, "\n").replace(/^"+|"+$/g, "").trim();
}

/**
 * Prefer FIREBASE_* (Service Account) if set.
 * Optionally fall back to GOOGLE_* if you’ve been using those.
 * If neither is set, fall back to applicationDefault() so it works on GCP/Emulator.
 */
const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL =
  process.env.FIREBASE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
const FIREBASE_PRIVATE_KEY = normalizeKey(
  process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY
);

let app: App;

if (!getApps().length) {
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    // Initialise with explicit service account (recommended for Vercel prod)
    app = initializeApp({
      credential: cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY,
      }),
    });
  } else {
    // Fallback: uses GOOGLE_APPLICATION_CREDENTIALS or GCP metadata (local/dev/GCP)
    // This prevents crashes if envs are missing in some environments.
    app = initializeApp({
      credential: applicationDefault(),
    });
    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
      // Optional: log a gentle warning to help with deployment debugging.
      console.warn(
        "[firebaseAdmin] Using applicationDefault() credentials. " +
          "Set FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY for explicit service account."
      );
    }
  }
} else {
  app = getApps()[0]!;
}

// Primary Firestore export (keeps your existing name)
export const adminDb: Firestore = getFirestore(app);

// Convenience re‑exports used by APIs
export const Timestamp = AdminTimestamp;
export const FieldValue = AdminFieldValue;

// If you also want an alias `db` (optional):
export const db = adminDb
