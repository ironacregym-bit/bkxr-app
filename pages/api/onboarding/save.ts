
// pages/api/profile.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../lib/firestoreClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const email = (req.query.email as string) || "";
  if (!email) return res.status(400).json({ error: "email is required" });

  try {
    const doc = await firestore.collection("Users").doc(email).get();
    if (!doc.exists) {
      return res.status(200).json({});
    }

    const u = doc.data() as any;

    // Return Users schema fields + onboarding extras used by the app
    return res.status(200).json({
      // Core identity
      email: u.email ?? email,
      name: u.name ?? null,
      image: u.image ?? null,
      created_at: u.created_at ?? null,
      last_login_at: u.last_login_at ?? null,

      // Metrics
      height_cm: u.height_cm ?? null,
      weight_kg: u.weight_kg ?? null,
      bodyfat_pct: u.bodyfat_pct ?? null,
      DOB: u.DOB ?? null,
      sex: u.sex ?? null,

      // Activity + computed targets
      activity_factor: u.activity_factor ?? null,
      calorie_target: u.calorie_target ?? null,
      protein_target: u.protein_target ?? null,
      carb_target: u.carb_target ?? null,
      fat_target: u.fat_target ?? null,

      // Goal selection (extras saved by onboarding)
      goal_primary: u.goal_primary ?? null,      // "lose" | "tone" | "gain"
      goal_intensity: u.goal_intensity ?? null,  // "small" | "large" | "maint" | "lean"

      // Location/gym/role
      gym_id: u.gym_id ?? null,
      location: u.location ?? null,
      role: u.role ?? null,

      // Onboarding extras for tailoring UX
      equipment: u.equipment ?? null,           // { bodyweight, kettlebell, dumbbell }
      preferences: u.preferences ?? null,       // { boxing_focus, kettlebell_focus, schedule_days }
    });
  } catch (err: any) {
    console.error("[profile] error:", err?.message || err);
    return res.status(500).json({error: "Failed to load profile" });
  }
}
