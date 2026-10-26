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

import { loadAgent } from "../../../lib/agents/loadAgent";
import { buildPrompt } from "../../../lib/agents/buildPrompt";

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
    /**
     * Validate Gemini configuration.
     */
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured",
      });
    }

    /**
     * User input supplied from
     * the AI Workout Coach page.
     */
    const {
      classType,
      classSize,
      duration,
      format,
      focus,
      requirements,
    } = req.body;

    /**
     * Load the agent definition.
     *
     * This agent lives in Firestore
     * so behaviour can be changed
     * without deploying code.
     */
    const agent =
      await loadAgent("farm-strong");

    /**
     * ==================================================
     * TOOL #1
     * EQUIPMENT
     * ==================================================
     */
    const equipment =
      await getEquipment();

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

    /**
     * ==================================================
     * TOOL #2
     * RECENT WORKOUT HISTORY
     * ==================================================
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

    /**
     * ==================================================
     * TOOL #3
     * EXERCISE LIBRARY
     * ==================================================
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

    /**
     * Build the final prompt.
     *
     * Prompt construction is no longer
     * hardcoded in this file.
     *
     * Firestore Agent
     * +
     * Tool Context
     * +
     * User Input
     */
    const prompt = buildPrompt(
      agent,
      {
        equipmentText,
        recentWorkoutText,
        exerciseText,
      },
      {
        classType,
        classSize,
        duration,
        format,
        focus,
        requirements,
      }
    );

    /**
     * Generate workout from Gemini.
     */
    const { text } = await generateText({
      model: googleAI(
        agent.model ||
          "gemini-2.5-flash"
      ),
      prompt,
    });

    /**
     * Save generated workout
     * as an approval draft.
     */
    const draftId =
      await saveDraft({
        agentName: agent.name,

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

    /**
     * Return draft to UI.
     */
    return res.status(200).json({
      workout: text,

      draftId,

      status: "draft",

      agent: agent.name,

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
