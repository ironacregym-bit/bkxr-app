import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

import { getEquipment } from "../../../lib/ai/getEquipment";
import { getRecentWorkouts } from "../../../lib/ai/getRecentWorkouts";
import { getExercises } from "../../../lib/ai/getExercises";
import { saveDraft } from "../../../lib/ai/saveDraft";

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    /*
     * Ensure Gemini has been configured.
     */
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured",
      });
    }

    /*
     * User-supplied workout requirements.
     */
    const {
      classType,
      classSize,
      duration,
      format,
      focus,
      requirements,
    } = req.body;

    /*
     * TOOL #1
     * Retrieve all available equipment.
     *
     * This forms part of the agent's
     * retrieval layer and prevents
     * the AI from programming
     * unavailable kit.
     */
    const equipment = await getEquipment();

    const equipmentText =
      equipment.length > 0
        ? equipment
            .map(
              (item: any) =>
                `- ${item.name}${
                  item.quantity
                    ? ` (x${item.quantity})`
                    : ""
                }${
                  item.notes
                    ? ` - ${item.notes}`
                    : ""
                }`
            )
            .join("\n")
        : "No equipment found";

    /*
     * TOOL #2
     * Retrieve recent workouts.
     *
     * This allows the agent to
     * avoid repetition and create
     * more intelligent programming.
     */
    const recentWorkouts =
      await getRecentWorkouts(10);

    const recentWorkoutText =
      recentWorkouts.length > 0
        ? recentWorkouts
            .map(
              (workout: any) => `
WORKOUT NAME:
${workout.workout_name || "Unknown"}

FOCUS:
${workout.focus || "Not specified"}

DAY:
${workout.recurring_day || "Not specified"}

BENCHMARK:
${workout.is_benchmark ? "Yes" : "No"}

WORKOUT DETAILS:
${workout.notes || "No workout notes"}
`
            )
            .join(
              "\n\n---------------------------------\n\n"
            )
        : "No recent workouts found";

    /*
     * TOOL #3
     * Retrieve approved exercises.
     *
     * The agent should only use
     * exercises that exist in the
     * Farm Strong exercise library.
     */
    const exercises =
      await getExercises("Farm Strong");

    const exerciseText =
      exercises.length > 0
        ? exercises
            .map(
              (exercise: any) => `
EXERCISE:
${exercise.exercise_name}

EQUIPMENT:
${exercise.equipment}

TYPE:
${exercise.type}
`
            )
            .join("\n")
        : "No approved exercises found";

    /*
     * Compose the complete AI context.
     *
     * This is effectively RAG:
     *
     * User Input
     * +
     * Equipment
     * +
     * Exercise Library
     * +
     * Workout History
     */
    const prompt = `
You are the Head Coach at Iron Acre.

AVAILABLE EQUIPMENT

${equipmentText}

RECENT WORKOUT HISTORY

${recentWorkoutText}

APPROVED FARM STRONG EXERCISES

${exerciseText}

PROGRAMMING RULES

- Avoid generic bootcamp workouts
- Respect participant numbers
- Respect equipment limitations
- Use realistic work/rest periods
- Use available equipment efficiently
- Ensure all athletes can participate
- Avoid repeating recent workouts
- Avoid repeating recent formats
- Avoid repeating recent movement patterns
- Only use exercises from the approved exercise library
- Do not invent exercises
- Match exercises to available equipment
- Vary training stimulus across sessions
- Prioritise strongman and functional fitness principles
- Create workouts that would genuinely be delivered at Iron Acre

CLASS DETAILS

Class Type:
${classType}

Class Size:
${classSize}

Duration:
${duration} minutes

Format:
${format}

Focus:
${focus}

SPECIAL REQUIREMENTS

${requirements}

OUTPUT FORMAT

SESSION TITLE

OVERVIEW

WARM UP

MAIN SESSION

FINISHER

COACHING NOTES

SCALING OPTIONS
`;

    /*
     * Generate the workout draft.
     */
    const { text } = await generateText({
      model: googleAI("gemini-2.5-flash"),
      prompt,
    });

    /*
     * Save the generated workout
     * as a draft awaiting approval.
     */
    const draftId = await saveDraft({
      classType,
      classSize,
      duration,
      format,
      focus,

      prompt: requirements,

      generated_workout: text,

      equipmentCount:
        equipment.length,

      exerciseCount:
        exercises.length,

      recentWorkoutCount:
        recentWorkouts.length,
    });

    /*
     * Return workout and draft
     * information to the UI.
     */
    return res.status(200).json({
      workout: text,

      draftId,

      status: "draft",

      equipmentCount:
        equipment.length,

      exerciseCount:
        exercises.length,

      recentWorkoutCount:
        recentWorkouts.length,
    });
  } catch (error: any) {
    console.error(
      "[AI WORKOUT ERROR]",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Failed to generate workout",
    });
  }
}
