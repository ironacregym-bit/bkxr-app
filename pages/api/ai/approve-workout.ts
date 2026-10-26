import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import firestore from "../../../lib/firestoreClient";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { draftId } = req.body;

    if (!draftId) {
      return res.status(400).json({
        error: "Draft Id required",
      });
    }

    const draftRef =
      firestore
        .collection("ai_workout_drafts")
        .doc(draftId);

    const draft =
      await draftRef.get();

    if (!draft.exists) {
      return res.status(404).json({
        error: "Draft not found",
      });
    }

    const data = draft.data();

    if (!data) {
      return res.status(404).json({
        error: "Draft data missing",
      });
    }

    const workout =
      data.workout || {};

    /**
     * Publish into new collection.
     */
    const workoutRef =
      await firestore
        .collection("class_workouts")
        .add({
          title:
            workout.title || "",

          overview:
            workout.overview || "",

          class_type:
            data.classType,

          class_size:
            data.classSize,

          duration:
            data.duration,

          format:
            data.format,

          focus:
            data.focus,

          warmup:
            workout.warmup || [],

          strength:
            workout.strength || [],

          conditioning:
            workout.conditioning || [],

          core:
            workout.core || [],

          cooldown:
            workout.cooldown || [],

          coach_notes:
            workout.coach_notes ||
            [],

          source:
            "AI Agent",

          agent:
            data.agentName,

          status:
            "published",

          published_at:
            new Date(),

          created_at:
            new Date(),
        });

    await draftRef.update({
      approved: true,
      status: "published",
      publishedWorkoutId:
        workoutRef.id,
      published_at:
        new Date(),
    });

    return res.status(200).json({
      success: true,
      workoutId:
        workoutRef.id,
    });
  } catch (error: any) {
    console.error(
      "[APPROVE WORKOUT ERROR]",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Failed to approve workout",
    });
  }
}
