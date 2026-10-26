import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

import { loadAgent } from "../../../lib/agents/loadAgent";
import { loadAgentContext } from "../../../lib/agents/loadAgentContext";
import { buildContext } from "../../../lib/agents/buildContext";
import { buildPrompt } from "../../../lib/agents/buildPrompt";

import { saveDraft } from "../../../lib/ai/saveDraft";

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Agent Runner
 *
 * Responsibilities:
 *
 * 1. Load Agent Definition
 * 2. Execute Agent Tools
 * 3. Build Agent Context
 * 4. Construct Prompt
 * 5. Generate Response
 * 6. Save Draft
 *
 * No workout logic is hardcoded here.
 */
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
     * Ensure API key exists.
     */
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured",
      });
    }

    /**
     * User input from UI.
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
     * Load the Farm Strong Agent
     * from Firestore.
     *
     * This contains:
     * - prompt
     * - rules
     * - tools
     * - model
     * - output format
     */
    const agent =
      await loadAgent("farm-strong");

    /**
     * Execute all tools
     * configured on the agent.
     *
     * Example:
     * [
     *   "equipment",
     *   "recentWorkouts",
     *   "exercises"
     * ]
     */
    const context =
      await loadAgentContext(agent);

    /**
     * Convert raw tool responses
     * into a structured block
     * to be supplied to the LLM.
     */
    const agentContext =
      buildContext(context);

    /**
     * Build final prompt.
     *
     * Prompt is now:
     *
     * Agent Definition
     * + Agent Context
     * + User Input
     */
    const prompt = buildPrompt(
      agent,
      agentContext,
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
     * Generate workout draft.
     */
    const { text } =
      await generateText({
        model: googleAI(
          agent.model ||
            "gemini-2.5-flash"
        ),
        prompt,
      });

    /**
     * Persist draft.
     *
     * Human approval occurs later
     * before publication.
     */
    const draftId =
      await saveDraft({
        agentId: "farm-strong",

        agentName:
          agent.name,

        classType,
        classSize,
        duration,
        format,
        focus,

        prompt:
          requirements,

        generated_workout:
          text,

        toolContext:
          context,

        status:
          "draft",
      });

    /**
     * Return draft to UI.
     */
    return res.status(200).json({
      workout: text,

      draftId,

      status: "draft",

      agent: agent.name,
    });
  } catch (error: any) {
    console.error(
      "[AI WORKOUT AGENT ERROR]",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Failed to generate workout",
    });
  }
}
