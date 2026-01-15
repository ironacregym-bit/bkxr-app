
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

function getDeep(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => (acc && acc[key] != null ? acc[key] : undefined), obj);
}

function isNonEmptyString(v: any): boolean {
  return typeof v === "string" && v.trim().length > 0;
}
function isPositiveNumber(v: any): boolean {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}
function hasDateValue(v: any): boolean {
  try {
    const d =
      v?.toDate?.() instanceof Date ? v.toDate()
      : isNonEmptyString(v) ? new Date(v as string)
      : v instanceof Date ? v
      : null;
    return !!(d && !isNaN(d.getTime()));
  } catch {
    return false;
  }
}

function metricsComplete(user: any): boolean {
  // Accept multiple field names / legacy nested shapes
  const h = getDeep(user, "height_cm") ?? getDeep(user, "metrics.height_cm");
  const w = getDeep(user, "weight_kg") ?? getDeep(user, "metrics.weight_kg");

  const dob = getDeep(user, "DOB") ?? getDeep(user, "dob") ?? getDeep(user, "date_of_birth");
  const sex = getDeep(user, "sex") ?? getDeep(user, "gender");

  return isPositiveNumber(h) && isPositiveNumber(w) && hasDateValue(dob) && isNonEmptyString(sex);
}

function goalComplete(user: any): boolean {
  const v = getDeep(user, "goal_primary") ?? getDeep(user, "main_goal") ?? getDeep(user, "goal");
  return isNonEmptyString(v);
}

function workoutTypeComplete(user: any): boolean {
  // Optional unless enforced by an active task
  const v = getDeep(user, "workout_type");
  return isNonEmptyString(v);
}

function fightingStyleComplete(user: any): boolean {
  // Optional unless enforced by an active task
  const v = getDeep(user, "fighting_style");
  return isNonEmptyString(v);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  const rawEmail = session.user.email.trim();
  const emailLc = rawEmail.toLowerCase();

  try {
    // Load task definitions (optional CMS control). If empty → use a minimal fallback
    const tasksSnap = await firestore
      .collection("tasks")
      .orderBy("priority", "asc")
      .get()
      .catch(() => null);
    const tasks = tasksSnap ? tasksSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) : [];

    // Your CURRENT onboarding baseline (only steps you want to enforce by default):
    // - metrics
    // - job/goal
    // NOTE: workout_type and fighting_style are OPTIONAL by default and are only enforced if present in tasks as active.
    const fallback = [
      { id: "t_metrics",        key: "metrics",        title: "Add your metrics",     targetPath: "/onboarding", priority: 1, active: true },
      { id: "t_goal",           key: "job_goal",       title: "Set your goal",        targetPath: "/onboarding", priority: 2, active: true },
      // no workout_type here
      // no fighting_style here (optional by default)
    ];

    // Live definitions in tasks override fallback; filter inactive
    const defs = (tasks.length > 0 ? tasks : fallback).filter((t) => t.active !== false);

    // Flags: only enforce these if an ACTIVE task exists
    const enforceWorkoutType   = defs.some((t) => t.key === "workout_type"   && t.active !== false);
    const enforceFightingStyle = defs.some((t) => t.key === "fighting_style" && t.active !== false);

    // Load user profile (lowercase doc id, fallback to original casing for legacy)
    let userDoc = await firestore.collection("users").doc(emailLc).get();
    if (!userDoc.exists && emailLc !== rawEmail) {
      userDoc = await firestore.collection("users").doc(rawEmail).get();
    }
    const userData = userDoc.exists ? (userDoc.data() as any) : {};

    // Optional completion flag (we still compute outstanding to be safe)
    const hasCompletionFlag = !!userData?.onboarding_completed_at;

    // Compute outstanding from defs:
    const outstanding = defs.filter((t) => {
      switch (t.key) {
        case "metrics": return !metricsComplete(userData);
        case "job_goal": // alias: "goal" task may come as job_goal in fallback
        case "goal":     return !goalComplete(userData);

        case "workout_type":
          return enforceWorkoutType ? !workoutTypeComplete(userData) : false;

        case "fighting_style":
          return enforceFightingStyle ? !fightingStyleComplete(userData) : false;

        default: {
          // Generic requiredFields support for ad‑hoc tasks
          const fields: string[] = Array.isArray(t.requiredFields) ? t.requiredFields : [];
          if (fields.length === 0) return false;
          return fields.some((f) => {
            const val = getDeep(userData, f);
            if (val === null || val === undefined) return true;
            if (typeof val === "string" && val.trim() === "") return true;
            return false;
          });
        }
      }
    });

    // Sorted list with minimal, stable shape
    const outstandingSorted = outstanding
      .sort((a, b) => Number(a.priority ?? 999) - Number(b.priority ?? 999))
      .map((t) => ({
        id: t.id,
        key: t.key,
        title: t.title,
        description: t.description || "",
        targetPath: t.targetPath || "/onboarding",
      }));

    // Build "missing" for UI modal (only for steps you care about)
    const missing: string[] = [];
    if (!metricsComplete(userData)) missing.push("metrics");
    if (!goalComplete(userData))    missing.push("job_goal");
    if (enforceWorkoutType && !workoutTypeComplete(userData))     missing.push("workout_type");
    if (enforceFightingStyle && !fightingStyleComplete(userData)) missing.push("fighting_style");

    // Final "complete" decision:
    const complete = (hasCompletionFlag && outstandingSorted.length === 0)
      || (!hasCompletionFlag && missing.length === 0);

    res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
    return res.status(200).json({
      complete,
      missing,
      outstanding: outstandingSorted,
      profile: userData ?? null,
    });
  } catch (err: any) {
    console.error("[onboarding/status] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to compute onboarding status" });
  }
}
