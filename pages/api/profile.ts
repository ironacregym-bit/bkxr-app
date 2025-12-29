
// pages/api/profile.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../lib/firestoreClient";

/**
 * Allowed fields to update via PATCH.
 * NOTE:
 * - We accept `caloric_target` as alias on input, but we store/read `calorie_target`.
 * - We include onboarding extras so the client can persist them in Users.
 */
const ALLOWED_KEYS = new Set([
  "email",
  "name",
  "image",
  "created_at",
  "last_login_at",
  "DOB",
  "sex",
  "height_cm",
  "weight_kg",
  "bodyfat_pct",
  "activity_factor",
  "calorie_target", // canonical
  "caloric_target", // alias (input only, converted to calorie_target)
  "protein_target",
  "carb_target",
  "fat_target",
  "gym_id",
  "location",
  "role",
  // onboarding extras
  "equipment",       // { bodyweight, kettlebell, dumbbell }
  "preferences",     // { boxing_focus, kettlebell_focus, schedule_days }
  // goals
  "goal_primary",    // "lose" | "tone" | "gain"
  "goal_intensity",  // "small" | "large" | "maint" | "lean"
]);

/** Response shape returned to client */
interface ProfileResponse {
  email: string;
  name: string;
  image: string;
  created_at: string;
  last_login_at: string;

  // metrics
  DOB: string;
  sex: string;
  height_cm: number | null;
  weight_kg: number | null;
  bodyfat_pct: number | null;

  // activity + targets (canonical: calorie_target)
  activity_factor: number | null;
  calorie_target: number | null;
  protein_target: number | null;
  carb_target: number | null;
  fat_target: number | null;

  // context
  gym_id: string | null;
  location: string;
  role: string | null;

  // goals
  goal_primary: "lose" | "tone" | "gain" | null;
  goal_intensity: "small" | "large" | "maint" | "lean" | null;

  // onboarding extras
  equipment: { bodyweight?: boolean; kettlebell?: boolean; dumbbell?: boolean } | null;
  preferences: { boxing_focus?: boolean; kettlebell_focus?: boolean; schedule_days?: number } | null;
}

/** Convert Firestore Timestamp or string to ISO string; fallback to "" */
function toIsoStringOrEmpty(value: any): string {
  if (!value) return "";
  if (typeof value === "object" && typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return "";
    }
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

/** Build a consistent response object */
function buildProfileResponse(email: string, data: Record<string, any> = {}): ProfileResponse {
  return {
    // identity
    email: (typeof data.email === "string" && data.email.trim()) || email,
    name: (typeof data.name === "string" && data.name) || "",
    image: (typeof data.image === "string" && data.image) || "",
    created_at: toIsoStringOrEmpty(data.created_at),
    last_login_at: toIsoStringOrEmpty(data.last_login_at),

    // metrics
    DOB: (typeof data.DOB === "string" && data.DOB) || "",
    sex: (typeof data.sex === "string" && data.sex) || "",
    height_cm: typeof data.height_cm === "number" ? data.height_cm : null,
    weight_kg: typeof data.weight_kg === "number" ? data.weight_kg : null,
    bodyfat_pct: typeof data.bodyfat_pct === "number" ? data.bodyfat_pct : null,

    // activity + targets
    activity_factor: typeof data.activity_factor === "number" ? data.activity_factor : null,
    calorie_target:
      typeof data.calorie_target === "number"
        ? data.calorie_target
        : typeof data.caloric_target === "number" // legacy alias, if present in stored data
        ? data.caloric_target
        : null,
    protein_target: typeof data.protein_target === "number" ? data.protein_target : null,
    carb_target: typeof data.carb_target === "number" ? data.carb_target : null,
    fat_target: typeof data.fat_target === "number" ? data.fat_target : null,

    // context
    gym_id: typeof data.gym_id === "string" ? data.gym_id : null,
    location: (typeof data.location === "string" && data.location.trim()) || "",
    role: typeof data.role === "string" ? data.role : null,

    // goals
    goal_primary:
      data.goal_primary === "lose" || data.goal_primary === "tone" || data.goal_primary === "gain"
        ? data.goal_primary
        : null,
    goal_intensity:
      data.goal_intensity === "small" ||
      data.goal_intensity === "large" ||
      data.goal_intensity === "maint" ||
      data.goal_intensity === "lean"
        ? data.goal_intensity
        : null,

    // onboarding extras
    equipment: data.equipment ?? null,
    preferences: data.preferences ?? null,
  };
}

/** Filter incoming PATCH body to allowed keys; aliasing `caloric_target` -> `calorie_target` */
function filterPatchBody(body: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (!body || typeof body !== "object") return out;

  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    let val = body[key];

    // Convert alias caloric_target -> calorie_target on input
    const targetKey = key === "caloric_target" ? "calorie_target" : key;

    // Normalise strings by trimming
    if (typeof val === "string") {
      out[targetKey] = val.trim();
      continue;
    }

    // Allow numbers/null directly
    if (typeof val === "number" || val === null) {
      out[targetKey] = val;
      continue;
    }

    // Allow Firestore Timestamp objects or Date objects unmodified
    if (val && (typeof (val as any).toDate === "function" || val instanceof Date)) {
      out[targetKey] = val;
      continue;
    }

    // Allow booleans or objects (equipment/preferences)
    if (typeof val === "boolean" || typeof val === "object") {
      out[targetKey] = val;
      continue;
    }
  }

  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const email = req.query.email as string;

  if (!email || typeof email !== "string" || !email.trim()) {
    return res.status(400).json({ error: "Email required" });
  }

  try {
    // Use capitalised Users collection as canonical source
    const docRef = firestore.collection("Users").doc(email.trim());

    if (req.method === "GET") {
      const snap = await docRef.get();

      if (!snap.exists) {
        // Return blank profile with all keys present for predictable client rendering
        return res.status(200).json(
          buildProfileResponse(email.trim(), {
            name: "",
            image: "",
            DOB: "",
            sex: "",
            height_cm: null,
            weight_kg: null,
            bodyfat_pct: null,
            activity_factor: null,
            calorie_target: null,
            protein_target: null,
            carb_target: null,
            fat_target: null,
            goal_primary: null,
            goal_intensity: null,
            equipment: null,
            preferences: null,
            gym_id: null,
            location: "",
            role: null,
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

    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (err: any) {
    console.error("Profile API error:", err?.message || err);
       return res.status(500).json({ error: "Failed to process profile request" });
  }
