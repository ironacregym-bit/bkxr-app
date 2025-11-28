
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../lib/firestoreClient"; // Firestore client

// The only fields we allow in the profile
const ALLOWED_KEYS = new Set([
  "DOB",
  "activity_factor",
  "bodyfat_pct",
  "caloric_target",
  "created_at",
  "email",
  "height_cm",
  "image",
  "last_login_at",
  "name",
  "sex",
  "weight_kg",
]);

// Response shape (all fields you specified)
interface ProfileResponse {
  DOB: string;                 // "" when unknown
  activity_factor: number | null;
  bodyfat_pct: number | null;
  caloric_target: number | null;
  created_at: string;          // ISO string or "" if not set
  email: string;               // provided in query or stored value
  height_cm: number | null;
  image: string;               // "" when unknown
  last_login_at: string;       // ISO string or "" if not set
  name: string;                // "" when unknown
  sex: string;                 // "" when unknown
  weight_kg: number | null;
}

/**
 * Convert Firestore Timestamp or string to ISO string.
 * If value is absent/invalid, return "".
 */
function toIsoStringOrEmpty(value: any): string {
  if (!value) return "";
  // Firestore Timestamp: has toDate()
  if (typeof value === "object" && typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return "";
    }
  }
  // If already a string that looks like a date, return as-is
  if (typeof value === "string") {
    // Optionally validate, but pass through to avoid mangling user data
    return value;
  }
  return "";
}

/**
 * Build a safe response object with defaults.
 * - Ensures only allowed fields appear.
 * - Normalises timestamp fields to strings.
 * - Applies empty-string / null defaults per your schema.
 */
function buildProfileResponse(email: string, data: Record<string, any> = {}): ProfileResponse {
  return {
    email: (typeof data.email === "string" && data.email.trim()) || email,
    name: (typeof data.name === "string" && data.name) || "",
    image: (typeof data.image === "string" && data.image) || "",
    DOB: (typeof data.DOB === "string" && data.DOB) || "",
    sex: (typeof data.sex === "string" && data.sex) || "",
    height_cm: typeof data.height_cm === "number" ? data.height_cm : null,
    weight_kg: typeof data.weight_kg === "number" ? data.weight_kg : null,
    bodyfat_pct: typeof data.bodyfat_pct === "number" ? data.bodyfat_pct : null,
    activity_factor: typeof data.activity_factor === "number" ? data.activity_factor : null,
    caloric_target: typeof data.caloric_target === "number" ? data.caloric_target : null,
    created_at: toIsoStringOrEmpty(data.created_at),
    last_login_at: toIsoStringOrEmpty(data.last_login_at),
  };
}

/**
 * Filter a payload so only ALLOWED_KEYS remain.
 * Also trims strings; leaves numbers/null as-is.
 * Timestamp fields can be provided as strings or Firestore Timestamp
 * —we store whatever is provided, and normalise only on response.
 */
function filterPatchBody(body: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (!body || typeof body !== "object") return out;

  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    const val = body[key];

    // Normalise strings by trimming
    if (typeof val === "string") {
      out[key] = val.trim();
      continue;
    }

    // Allow numbers/null directly
    if (typeof val === "number" || val === null) {
      out[key] = val;
      continue;
    }

    // Allow Firestore Timestamp objects or Date objects unmodified;
    // they will be normalised when building the response.
    if (val && (typeof val.toDate === "function" || val instanceof Date)) {
      out[key] = val;
      continue;
    }

    // For anything else (e.g., undefined), skip
  }

  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const email = req.query.email as string;

  if (!email || typeof email !== "string" || !email.trim()) {
    return res.status(400).json({ error: "Email required" });
  }

  try {
    const docRef = firestore.collection("users").doc(email.trim());

    if (req.method === "GET") {
      const snap = await docRef.get();

      if (!snap.exists) {
        // Return a blank profile object (no reference to any current user)
        return res.status(200).json(
          buildProfileResponse(email.trim(), {
            // explicit blanks/nulls so the client can rely on keys existing
            name: "",
            image: "",
            DOB: "",
            sex: "",
            height_cm: null,
            weight_kg: null,
            bodyfat_pct: null,
            activity_factor: null,
            caloric_target: null,
            created_at: "",
            last_login_at: "",
          })
        );
      }

      const data = snap.data() || {};
      return res.status(200).json(buildProfileResponse(email.trim(), data));
    }

    if (req.method === "PATCH") {
      const filtered = filterPatchBody(req.body);

      if (Object.keys(filtered).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      // Ensure email field remains consistent with doc ID if provided
      if (typeof filtered.email === "string") {
        filtered.email = email.trim();
      }

      await docRef.set(filtered, { merge: true });
      const updated = await docRef.get();
      return res.status(200).json(buildProfileResponse(email.trim(), updated.data() || {}));
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    console.error("Profile API error:", err?.message || err);
    return res.status(500).json({ error: "Failed to process profile request" });
  }
}
