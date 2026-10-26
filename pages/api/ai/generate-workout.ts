import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import { generateText } from "ai";

import { loadAgent } from "../../../lib/agents/loadAgent";
import { loadAgentContext } from "../../../lib/agents/loadAgentContext";
import { buildContext } from "../../../lib/agents/buildContext";
import { buildPrompt } from "../../../lib/agents/buildPrompt";
import { getAgentModel } from "../../../lib/agents/getAgentModel";

import { saveDraft } from "../../../lib/ai/saveDraft";

/**
 * Generic Agent Runner
 *
 * Responsibilities
 * ----------------
 * 1. Load agent definition from Firestore
 * 2. Execute the tools assigned to that agent
 * 3. Build AI context dynamically
 * 4. Construct a prompt from agent configuration
 * 5. Generate a response using the configured model
 * 6. Save a draft for approval
 *
 * This route contains no Farm Strong specific logic.
 * The behaviour is controlled by the agent definition.
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
     * Validate configuration.
     */
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured",
      });
    }

    /**
     * User supplied input from UI.
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
     * Load Firestore agent definition.
     *
     * Future:
     *
     * farm-strong
     * hyrox
     * nutrition
     * programming-review
     */
    const agent =
      await loadAgent("farm-strong");

    /**
     * Execute all configured tools.
     *
     * Example tools:
     * - equipment
     * - recentWorkouts
     * - exercises
     */
    const context =
      await loadAgentContext(agent);

    /**
     * Convert tool output into a format
     * suitable for the LLM.
     */
    const agentContext =
      buildContext(context);

    /**
     * Build final prompt.
     *
     * Prompt =
     * Agent Definition +
     * Tool Context +
     * User Input
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
     * Generate response using
     * the model configured on
     * the agent definition.
     */
    const { text } =
      await generateText({
        model: getAgentModel(agent),
        prompt,
      });

    /**
     * Save generated workout as a draft.
     *
     * Human approval happens later
     * before publishing.
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
