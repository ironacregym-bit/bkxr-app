
// pages/api/onboarding/save.ts
import type { NextApiRequest, NextApiResponse } from "next";
// IMPORTANT: for API routes use the next-auth/next entrypoint to reliably get the session
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const {
    email,
    // metrics
    sex,
    height_cm,
    weight_kg,
    bodyfat_pct,
    DOB,
    // activity + targets (canonical caloric_target)
    activity_factor,
    caloric_target,   // canonical
    calorie_target,   // alias → map to caloric_target
    protein_target,
    carb_target,
    fat_target,
    // goals
    goal_primary,
    goal_intensity,
    // context
    gym_id,
    location,
    role,
    // extras
    equipment,
    preferences,
    // optional markers from the UI
    onboarding_started_at,
  } = req.body || {};

  // Always trust the session email; use body as a fallback only for admin/automation if you add it later.
  const userEmail = String(email || session.user.email);

  try {
    const usersRef = firestore.collection("users").doc(userEmail);
    const snap = await usersRef.get();
    const nowIso = new Date().toISOString();

    // Helper to include only values that are explicitly provided.
    // Change the condition to `val !== undefined && val !== null` if you want to skip nulls too.
    const addIfDefined = (obj: Record<string, any>, key: string, val: any) => {
      if (val !== undefined) obj[key] = val;
      // If you want to AVOID overwriting with nulls, use:
      // if (val !== undefined && val !== null) obj[key] = val;
    };

    const payload: Record<string, any> = {};
    // Always keep email + timestamps current
    payload.email = userEmail;
    payload.last_login_at = nowIso;
    if (!snap.exists) payload.created_at = nowIso;

    // Metrics
    addIfDefined(payload, "sex", sex ?? null);
    addIfDefined(payload, "height_cm", height_cm != null ? Number(height_cm) : null);
    addIfDefined(payload, "weight_kg", weight_kg != null ? Number(weight_kg) : null);
    addIfDefined(payload, "bodyfat_pct", bodyfat_pct != null ? Number(bodyfat_pct) : null);
    addIfDefined(payload, "DOB", DOB ?? null);

    // Activity + targets (store as caloric_target; accept alias)
    const resolvedCaloric =
      caloric_target != null
        ? Number(caloric_target)
        : calorie_target != null
        ? Number(calorie_target)
        : undefined; // undefined means "don't touch"
    addIfDefined(payload, "activity_factor", activity_factor != null ? Number(activity_factor) : null);
    addIfDefined(payload, "caloric_target", resolvedCaloric);
    addIfDefined(payload, "protein_target", protein_target != null ? Number(protein_target) : null);
    addIfDefined(payload, "carb_target", carb_target != null ? Number(carb_target) : null);
    addIfDefined(payload, "fat_target", fat_target != null ? Number(fat_target) : null);

    // Goals
    addIfDefined(payload, "goal_primary", goal_primary ?? null);
    addIfDefined(payload, "goal_intensity", goal_intensity ?? null);

    // Context
    addIfDefined(payload, "gym_id", gym_id ?? null);
    addIfDefined(payload, "location", location ?? null);
    addIfDefined(payload, "role", role ?? null);

    // Extras
    addIfDefined(payload, "equipment", equipment ?? null);
    addIfDefined(payload, "preferences", preferences ?? null);

    // Optional: record onboarding_started_at if the UI sends it (idempotent marker)
    if (onboarding_started_at) {
      addIfDefined(payload, "onboarding_started_at", onboarding_started_at);
    }

    // Nothing to write? Return early (helps you debug from the Network tab)
    const writeKeys = Object.keys(payload);
    if (writeKeys.length === 0) {
      return res.status(200).json({ ok: true, wrote: 0 });
    }

    await usersRef.set(payload, { merge: true });

    // Return which keys we wrote (debug visibility)
    return res.status(200).json({ ok: true, wrote: writeKeys.length, keys: writeKeys });
  } catch (err: any) {
    console.error("[onboarding/save] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to save onboarding" });
   }
}
