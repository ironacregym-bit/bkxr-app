import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

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
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured",
      });
    }

    const {
      classType,
      classSize,
      duration,
      format,
      focus,
      equipmentNotes,
      requirements,
    } = req.body;

    const prompt = `
You are the Head Coach at Iron Acre.

Create a complete, ready-to-run workout.

RULES:
- Avoid generic bootcamp workouts
- Make the session engaging and well structured
- Respect participant numbers
- Respect equipment limitations
- Use realistic work/rest periods
- Include coaching notes
- Keep transitions practical
- Make the workout suitable for real delivery

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

Equipment:
${equipmentNotes}

Special Requirements:
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

    const { text } = await generateText({
      model: googleAI("gemini-2.5-flash"),
      prompt,
      maxTokens: 2000,
    });

    return res.status(200).json({
      workout: text,
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
