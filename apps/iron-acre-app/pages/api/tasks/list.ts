
// pages/api/tasks/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

type TaskDef = {
  id: string;
  key: string;                   // machine key, e.g., "add_metrics"
  title: string;                 // card title
  description?: string;
  targetPath?: string;           // where to send user (e.g., "/onboarding")
  requiredFields?: string[];     // fields to check on Users doc
  priority?: number;             // sort asc
  active?: boolean;
};

const FALLBACK_TASKS: TaskDef[] = [
  {
    id: "t_add_metrics",
    key: "add_metrics",
    title: "Add your metrics",
    description: "Height, weight, age, and gender",
    targetPath: "/onboarding",
    requiredFields: ["height_cm", "weight_kg", "DOB", "sex"],
    priority: 1,
    active: true,
  },
  {
    id: "t_set_goal",
    key: "set_goal",
    title: "Set your goal",
    description: "Lose weight, tone up, or build muscle",
    targetPath: "/onboarding",
    requiredFields: ["goal_primary", "goal_intensity"],
    priority: 2,
    active: true,
  },
  {
    id: "t_select_equipment",
    key: "select_equipment",
    title: "Select your equipment",
    description: "Bodyweight, Kettlebell, or Dumbbell",
    targetPath: "/onboarding",
    requiredFields: ["equipment.bodyweight", "equipment.kettlebell", "equipment.dumbbell"],
    priority: 3,
    active: true,
  },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const snap = await firestore.collection("tasks").orderBy("priority", "asc").get();
    const tasks: TaskDef[] = snap.docs.map((d) => {
      const x = d.data() as any;
      return {
        id: d.id,
        key: x.key || d.id,
        title: x.title || "Task",
        description: x.description || "",
        targetPath: x.targetPath || "/onboarding",
        requiredFields: Array.isArray(x.requiredFields) ? x.requiredFields : [],
        priority: Number(x.priority ?? 999),
        active: x.active !== false,
      };
    });

    const list = tasks.length > 0 ? tasks.filter((t) => t.active !== false) : FALLBACK_TASKS;
    return res.status(200).json({ tasks: list });
  } catch (err: any) {
    console.error("[tasks/list] error:", err?.message || err);
    return res.status(200).json({ tasks: FALLBACK_TASKS });
  }
}
