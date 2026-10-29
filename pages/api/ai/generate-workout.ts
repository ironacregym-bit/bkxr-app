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

import {
  logExecution,
} from "../../../lib/agents/logExecution";

/**
 * =====================================================
 * WORKOUT GENERATION AGENT
 * =====================================================
 *
 * Purpose
 * -------
 *
 * Executes the Farm Strong agent.
 *
 * Responsibilities
 * ----------------
 *
 * 1. Load agent definition
 * 2. Load tool context
 * 3. Build prompt
 * 4. Call model
 * 5. Parse JSON response
 * 6. Save draft
 * 7. Log execution
 *
 * Future
 * -------
 *
 * - Runtime Logs
 * - Token Usage
 * - Cost Tracking
 * - Multi-Agent Flows
 * - Workflow Execution
 *
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startedAt = new Date();

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error:
          "GEMINI_API_KEY is not configured",
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

    /**
     * Load Agent Definition
     */
    const agent =
      await loadAgent(
        "farm-strong"
      );

    /**
     * Load Agent Tool Context
     */
    const context =
      await loadAgentContext(
        agent
      );

    /**
     * Transform Context
     */
    const agentContext =
      buildContext(context);

    /**
     * Build Prompt
     */
    const prompt =
      buildPrompt(
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
     * Execute LLM
     */
    const { text } =
      await generateText({
        model:
          getAgentModel(
            agent
          ),
        prompt,
      });

    /**
     * Parse JSON Output
     */
    let workout;

    try {
      workout =
        JSON.parse(text);
    } catch (error) {
      console.error(
        "[INVALID JSON RESPONSE]",
        text
      );

      return res.status(500).json({
        error:
          "Agent returned invalid JSON. Update prompt and try again.",
      });
    }

    /**
     * Save Draft
     */
    const draftId =
      await saveDraft({
        agentId:
          "farm-strong",

        agentName:
          agent.name,

        classType,
        classSize,
        duration,
        format,
        focus,

        prompt:
          requirements,

        workout,

        toolContext:
          context,

        status:
          "draft",
      });

    /**
     * Log Successful Execution
     */
    const completedAt =
      new Date();

    await logExecution({
      agentId:
        "farm-strong",

      agentName:
        agent.name,

      executionType:
        "generate_workout",

      status:
        "success",

      startedAt,

      completedAt,

      durationMs:
        completedAt.getTime() -
        startedAt.getTime(),

      toolsUsed:
        agent.tools || [],

      input: {
        classType,
        classSize,
        duration,
        format,
        focus,
        requirements,
      },

      outputSummary: {
        workoutTitle:
          workout?.title ||
          null,
      },

      draftId,
    });

    return res.status(200).json({
      workout,
      draftId,
      status:
        "draft",
      agent:
        agent.name,
    });

  } catch (error: any) {

    console.error(
      "[AI WORKOUT AGENT ERROR]",
      error
    );

    /**
     * Log Failed Execution
     */
    const completedAt =
      new Date();

    await logExecution({
      agentId:
        "farm-strong",

      agentName:
        "Farm Strong Agent",

      executionType:
        "generate_workout",

      status:
        "failed",

      startedAt,

      completedAt,

      durationMs:
        completedAt.getTime() -
        startedAt.getTime(),

      toolsUsed: [],

      input: {
        error:
          error?.message,
      },
    });

    return res.status(500).json({
      error:
        error?.message ||
        "Failed to generate workout",
    });
  }
}
