
// pages/api/profile.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../lib/firestoreClient";

/**
 * Allowed fields to update via PATCH.
 * We accept calorie_target as alias on input, but store/read caloric_target.
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
  "caloric_target",  // canonical
  "calorie_target",  // alias accepted on input, converted to caloric_target
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
  // 🔐 premium access flags
  "subscription_status", // "active" | "trialing" | "canceled" | etc. (string pass-through)
  "membership_status",   // "gym_member" | "online" | "none" | etc.
]);

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

  // activity + targets (canonical: caloric_target)
  activity_factor: number | null;
  caloric_target: number | null;
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

  // 🔐 premium access flags
  subscription_status: string | null;
  membership_status: string | null;
}

function toIsoStringOrEmpty(value: any): string {
  if (!value) return "";
  if (typeof value === "object" && typeof value.toDate === "function") {
    try { return value.toDate().toISOString(); } catch { return ""; }
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    const ms = value.seconds * 1000 + Math.floor((value.nanoseconds ?? 0) / 1e6);
    return new Date(ms).toISOString();
  }
  if (typeof value === "object" && typeof value._seconds === "number") {
    const ms = value._seconds * 1000 + Math.floor((value._nanoseconds ?? 0) / 1e6);
    return new Date(ms).toISOString();
  }
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  return "";
}

function buildProfileResponse(email: string, data: Record<string, any> = {}): ProfileResponse {
  // Prefer caloric_target; fallback to calorie_target if older docs have it
  const caloric =
    typeof data.caloric_target === "number" ? data.caloric_target :
    typeof data.calorie_target === "number" ? data.calorie_target : null;

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
    caloric_target: caloric,
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

    // 🔐 premium access flags (pass-through; string or null)
    subscription_status: typeof data.subscription_status === "string" ? data.subscription_status : null,
    membership_status: typeof data.membership_status === "string" ? data.membership_status : null,
  };
}

// Filter PATCH body: allow only whitelisted keys, skip null/undefined, map alias -> canonical
function filterPatchBody(body: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (!body || typeof body !== "object") return out;

  for (const key of Object.keys(body)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    const targetKey = key === "calorie_target" ? "caloric_target" : key;
    const val = (body as Record<string, any>)[key];

    if (val === null || val === undefined) continue; // ⛔️ skip null/undefined to avoid wipes

    // Normalise strings (lowercase for specific fields)
    if (typeof val === "string") {
      let v = val.trim();
      if (targetKey === "sex" || targetKey === "goal_primary" || targetKey === "goal_intensity") {
        v = v.toLowerCase();
      }
      out[targetKey] = v;
      continue;
    }

    // Numbers, booleans, objects, Dates are allowed as-is
    if (typeof val === "number" || typeof val === "boolean" || typeof val === "object") {
      out[targetKey] = val;
      continue;
    }
  }
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const emailParam = req.query.email as string;
  const email = decodeURIComponent(String(emailParam || "")).trim();
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  try {
    // Use lowercase 'users' collection; docId is the email string
    const docRef = firestore.collection("users").doc(email);

    if (req.method === "GET") {
      const snap = await docRef.get();
      if (!snap.exists) {
        return res.status(200).json(
          buildProfileResponse(email, {
            name: "", image: "", DOB: "", sex: "",
            height_cm: null, weight_kg: null, bodyfat_pct: null,
            activity_factor: null, caloric_target: null,
            protein_target: null, carb_target: null, fat_target: null,
            goal_primary: null, goal_intensity: null,
            equipment: null, preferences: null, gym_id: null,
            location: "", role: null, created_at: "", last_login_at: "",
            subscription_status: null, membership_status: null,
          })
        );
      }
      const data = snap.data() || {};
      return res.status(200).json(buildProfileResponse(email, data));
    }

    if (req.method === "PATCH") {
      const filtered = filterPatchBody(req.body);
      if (Object.keys(filtered).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      // Maintain identity consistency (server is source of truth)
      filtered.email = email;

      await docRef.set(filtered, { merge: true });
      const updated = await docRef.get();
      return res.status(200).json(buildProfileResponse(email, updated.data() || {}));
    }

    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (err: any) {
    console.error("Profile API error:", err?.message || err);
    return res.status(500).json({ error: "Failed to process profile request" });
  }
}
