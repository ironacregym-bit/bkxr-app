import firestore from "../firestoreClient";

/**
 * Persists a generated AI workout
 * before a coach approves it.
 *
 * AGENT PURPOSE
 * -------------
 * Drafts provide a human review
 * stage before publication.
 */
export async function saveDraft(
  data: any
) {
  const docRef = await firestore
    .collection("ai_workout_drafts")
    .add({
      ...data,
      status: "draft",
      approved: false,
      created_at: new Date(),
    });

  return docRef.id;
}
