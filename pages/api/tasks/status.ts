
// pages/api/onboarding/status.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import firestore from "../../../lib/firestoreClient";

function getDeep(obj: any, path: string): any {
  // Supports "equipment.kettlebell"
  return path.split(".").reduce((acc, key) => (acc && acc[key] != null ? acc[key] : undefined), obj);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.email) return res.status(401).json({ error: "Unauthorized" });

  const userEmail = session.user.email;

  try {
    // Load tasks
    const tasksSnap = await firestore.collection("tasks").orderBy("priority", "asc").get();
    const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    const fallback = [
      { id: "t_add_metrics", key: "add_metrics", title: "Add your metrics", targetPath: "/onboarding", requiredFields: ["height_cm","weight_kg","DOB","sex"], priority: 1, active: true },
      { id: "t_set_goal", key: "set_goal", title: "Set your goal", targetPath: "/onboarding", requiredFields: ["goal_primary","goal_intensity"], priority: 2, active: true },
      { id: "t_select_equipment", key: "select_equipment", title: "Select your equipment", targetPath: "/onboarding", requiredFields: ["equipment.bodyweight","equipment.kettlebell","equipment.dumbbell"], priority: 3, active: true },
    ];
    const defs = (tasks.length > 0 ? tasks : fallback).filter((t) => t.active !== false);

    // Load profile
    const userDoc = await firestore.collection("Users").doc(userEmail).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    const outstanding = defs.filter((t) => {
      const fields: string[] = Array.isArray(t.requiredFields) ? t.requiredFields : [];
      if (fields.length === 0) return false; // no requirements means no need to show
      return fields.some((f) => {
        const val = getDeep(userData, f);
        // treat empty string, null, undefined as missing; booleans false count as missing unless explicitly required true
        if (typeof val === "boolean") {
          return val !== true;
        }
        return val == null || val === "";
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
    return res.status(500).json({ error:    return res.status(500).json({ error: "Failed to compute onboarding status" });
  }
}
