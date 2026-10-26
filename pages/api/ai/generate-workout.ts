import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// Tool 1: Equipment retrieval
import { getEquipment } from "../../../lib/ai/getEquipment";

// Tool 2: Historical workout retrieval
import { getRecentWorkouts } from "../../../lib/ai/getRecentWorkouts";

// Create Gemini client using environment variable
const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    // Validate configuration
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured",
      });
    }

    // User input from the UI
    const {
      classType,
      classSize,
      duration,
      format,
      focus,
      requirements,
    } = req.body;

    /*
     * TOOL CALL #1
     * Retrieve current equipment from Firestore
     */
    const equipment = await getEquipment();

    /*
     * Convert equipment into
     * human-readable prompt context
     */
    const equipmentText =
      equipment.length > 0
        ? equipment
            .map((item: any) => {
              return `- ${item.name}${
                item.quantity
                  ? ` (x${item.quantity})`
                  : ""
              }${
                item.notes
                  ? ` - ${item.notes}`
                  : ""
              }`;
            })
            .join("\n")
        : "No equipment found";

    /*
     * TOOL CALL #2
     * Retrieve recent workouts so the agent
     * can avoid creating duplicates
     */
    const recentWorkouts =
      await getRecentWorkouts(10);

    /*
     * Convert workout history into
     * prompt context
     */
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
     * AGENT CONTEXT
     *
     * This is where we combine:
     * 1. User request
     * 2. Equipment
     * 3. Workout history
     *
     * This effectively creates a
     * Retrieval Augmented Generation (RAG)
     * system backed by Firestore.
     */
    const prompt = `
You are the Head Coach at Iron Acre.

AVAILABLE EQUIPMENT

${equipmentText}

RECENT WORKOUT HISTORY

${recentWorkoutText}

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
- Vary training stimulus across sessions
- Prioritise strongman and functional fitness principles where appropriate
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
     * Generate workout using Gemini
     * with all retrieved context
     */
    const { text } = await generateText({
      model: googleAI("gemini-2.5-flash"),
      prompt,
    });

    /*
     * Return response to UI
     */
    return res.status(200).json({
      workout: text,
      equipmentCount:
        equipment.length,
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
