import firestore from "../firestoreClient";

/**
 * Represents a single exercise stored
 * in the Firestore exercise library.
 *
 * The AI agent uses this information
 * to ensure it only generates workouts
 * using approved Iron Acre movements.
 */
export interface Exercise {
  id: string;

  // Farm Strong, Strength, Conditioning etc.
  Class?: string;

  // Equipment needed to perform exercise
  equipment?: string;

  // Human readable exercise name
  exercise_name?: string;

  // Broad movement category
  type?: string;

  // Optional coaching description
  description?: string;

  // Useful for future calorie estimates
  met_value?: number;

  video_url?: string;

  gif_url?: string;
}

/**
 * Retrieves approved exercises from Firestore.
 *
 * AGENT PURPOSE
 * -------------
 * This is a Retrieval-Augmented Generation (RAG)
 * tool used by the Workout Coach Agent.
 *
 * Rather than allowing Gemini to invent
 * exercises, the agent retrieves the
 * official exercise catalogue from Firestore
 * and uses it as generation context.
 *
 * BENEFITS
 * --------
 * - Prevents hallucinated exercises
 * - Enforces Farm Strong standards
 * - Allows exercise library management
 *   by coaches without code changes
 * - Makes workout generation data-driven
 * - Provides organisational knowledge
 *   to the LLM
 *
 * Typical Usage:
 *
 * const exercises =
 *   await getExercises("Farm Strong");
 */
export async function getExercises(
  workoutClass = "Farm Strong"
): Promise<Exercise[]> {

  /**
   * Query Firestore for exercises
   * belonging to the requested class.
   *
   * Example:
   *
   * "Farm Strong"
   * "Strength"
   * "Conditioning"
   */
  const snapshot = await firestore
    .collection("exercises")
    .where("class", "==", workoutClass)
    .get();

  /**
   * Convert Firestore documents
   * into strongly typed Exercise objects.
   */
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Exercise[];
}
