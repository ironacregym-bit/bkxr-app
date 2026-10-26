import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
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
You are an elite functional fitness coach.

Create a complete workout.

Class Type: ${classType}
Class Size: ${classSize}
Duration: ${duration} minutes
Format: ${format}
Focus: ${focus}

Equipment:
${equipmentNotes}

Requirements:
${requirements}

The workout should include:

1. Warm Up
2. Main Workout
3. Finisher (if appropriate)
4. Coaching Notes

Make it practical and ready to deliver.
`;

    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt,
    });

    return res.status(200).json({
      workout: text,
    });
  } catch (error: any) {
    console.error(error);

    return res.status(500).json({
      error:
        error?.message ||
        "Failed to generate workout",
    });
  }
}
