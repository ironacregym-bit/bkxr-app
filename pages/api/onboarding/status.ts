
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

function getDeep(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => (acc && acc[key] != null ? acc[key] : undefined), obj);
}

function metricsComplete(user: any): boolean {
  const h = Number(user?.height_cm);
  const w = Number(user?.weight_kg);
  return h > 0 && w > 0 && !!user?.DOB && !!user?.sex;
}
function jobGoalComplete(user: any): boolean {
  return !!user?.goal_primary;
}
function workoutTypeComplete(user: any): boolean {
  return !!user?.workout_type;
}
function fightingStyleComplete(user: any): boolean {
  return !!user?.fighting_style;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  const userEmail = session.user.email;

  try {
    // Load task definitions (optional), otherwise fallback list
    const tasksSnap = await firestore.collection("tasks").orderBy("priority", "asc").get().catch(() => null);
    const tasks = tasksSnap ? tasksSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) : [];

    const fallback = [
      { id: "t_metrics", key: "metrics", title: "Add your metrics", targetPath: "/onboarding", priority: 1, active: true },
      { id: "t_job_goal", key: "job_goal", title: "Set your goal", targetPath: "/onboarding", priority: 2, active: true },
      { id: "t_workout_type", key: "workout_type", title: "Choose workout type", targetPath: "/onboarding", priority: 3, active: true },
      { id: "t_fighting_style", key: "fighting_style", title: "Choose fighting style", targetPath: "/onboarding", priority: 4, active: true },
    ];
    const defs = (tasks.length > 0 ? tasks : fallback).filter((t) => t.active !== false);

    // Load profile from canonical lowercase collection
    const userDoc = await firestore.collection("users").doc(userEmail).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    const outstanding = defs.filter((t) => {
      const key = t.key;
      if (key === "metrics") return !metricsComplete(userData);
      if (key === "job_goal") return !jobGoalComplete(userData);
      if (key === "workout_type") return !workoutTypeComplete(userData);
      if (key === "fighting_style") return !fightingStyleComplete(userData);

      // If a task points to onboarding and all onboarding sections are complete, hide
      if ((t.targetPath || "").toLowerCase().includes("/onboarding")) {
        return !(metricsComplete(userData) && jobGoalComplete(userData) && workoutTypeComplete(userData) && fightingStyleComplete(userData));
      }

      // Generic field presence support if a custom task uses requiredFields
      const fields: string[] = Array.isArray(t.requiredFields) ? t.requiredFields : [];
      if (fields.length === 0) return false;
      return fields.some((f) => {
        const val = getDeep(userData, f);
        return val == null || val === ""; // booleans are not assumed required-true by default
      });
    });

    return res.status(200).json({
      outstanding: outstanding
        .sort((a, b) => Number(a.priority ?? 999) - Number(b.priority ?? 999))
        .map((t) => ({
          id: t.id,
          key: t.key,
          title: t.title,
          description: t.description || "",
          targetPath: t.targetPath || "/onboarding",
               })),
    });
  } catch (err: any) {
    console.error("[onboarding/status] error:", err?.message || err);
    return res.status(500).json({ error: "Failed to compute onboarding status" });
  }
}
