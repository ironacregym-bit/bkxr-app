import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

import { getEquipment } from "../../../lib/ai/getEquipment";

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
      requirements,
    } = req.body;

    const equipment = await getEquipment();

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

    const prompt = `
You are the Head Coach at Iron Acre.

AVAILABLE EQUIPMENT

${equipmentText}

GYM RULES

- Avoid generic bootcamp workouts
- Respect participant numbers
- Respect equipment limitations
- Use realistic work/rest periods
- Include coaching notes
- Create sessions that are practical to coach
- Use available equipment efficiently
- Ensure all athletes can participate
- Prioritise strongman and functional fitness principles where appropriate

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

    const { text } = await generateText({
      model: googleAI("gemini-2.5-flash"),
      prompt,
    });

    return res.status(200).json({
      workout: text,
      equipmentUsed: equipment.length,
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
