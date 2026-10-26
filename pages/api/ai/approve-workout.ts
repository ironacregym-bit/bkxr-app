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

    // Create production workout
    const workout =
      await firestore
        .collection("workouts")
        .add({
          ...data,
          source: "AI Agent",
          approved: true,
          published_at: new Date(),
        });

    // Update draft status
    await draftRef.update({
      approved: true,
      status: "published",
    });

    return res.status(200).json({
      success: true,
      workoutId: workout.id,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error.message,
    });
  }
}
