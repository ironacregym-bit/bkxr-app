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

import {
  logRuntimeEvent,
} from "../../../lib/agents/logRuntimeEvent";

import {
  logTokenUsage,
} from "../../../lib/agents/logTokenUsage";

/**
 * =====================================================
 * WORKOUT GENERATION AGENT
 * =====================================================
 *
 * Purpose
 * -------
 *
 * Executes the Farm Strong Agent.
 *
 * Flow
 * ----
 *
 * 1. Load Agent Definition
 * 2. Load Tool Context
 * 3. Build Context
 * 4. Build Prompt
 * 5. Execute LLM
 * 6. Parse Response
 * 7. Save Draft
 * 8. Log Runtime Events
 * 9. Log Execution
 *
 * Future
 * -------
 *
 * - Multi-Agent Workflows
 * - Cost Tracking
 * - Token Tracking
 * - Evaluation Scoring
 * - Workflow Orchestration
 *
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startedAt = new Date();

  const executionId =
    crypto.randomUUID();

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
     * Load Agent
     */

    const agent =
      await loadAgent(
        "farm-strong"
      );

    await logRuntimeEvent({
      executionId,

      agentId:
        "farm-strong",

      level: "info",

      step:
        "agent_load",

      message:
        "Agent definition loaded",
    });

    /**
     * Load Context
     */

    const context =
      await loadAgentContext(
        agent
      );

    await logRuntimeEvent({
      executionId,

      agentId:
        "farm-strong",

      level: "info",

      step:
        "context_load",

      message:
        "Agent context loaded",

      metadata: {
        tools:
          agent.tools || [],
      },
    });

    /**
     * Build Context
     */

    const agentContext =
      buildContext(context);

    await logRuntimeEvent({
      executionId,

      agentId:
        "farm-strong",

      level: "info",

      step:
        "context_build",

      message:
        "Agent context built",
    });

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

    await logRuntimeEvent({
      executionId,

      agentId:
        "farm-strong",

      level: "info",

      step:
        "prompt_generation",

      message:
        "Prompt generated successfully",
    });

    /**
     * Execute Model
     */

    await logRuntimeEvent({
      executionId,

      agentId:
        "farm-strong",

      level: "info",

      step:
        "model_execution",

      message:
        "Calling Gemini model",
    });

    const result =
      await generateText({
        model:
          getAgentModel(
            agent
          ),
        prompt,
      });

    const text =
      result.text;

    if (result.usage) {

      const promptTokens =
        result.usage.promptTokens || 0;
    
      const completionTokens =
        result.usage
          .completionTokens || 0;
    
      const totalTokens =
        result.usage.totalTokens ||
        0;
    
      const estimatedCost =
        totalTokens *
        0.0000005;
    
      await logTokenUsage({
        executionId,
    
        agentId:
          "farm-strong",
    
        agentName:
          agent.name,
    
        model:
          agent.model,
    
        promptTokens,
    
        completionTokens,
    
        totalTokens,
    
        estimatedCost,
      });
    }

    await logRuntimeEvent({
      executionId,

      agentId:
        "farm-strong",

      level: "info",

      step:
        "model_response",

      message:
        "Model response received",
    });

    /**
     * Parse JSON
     */

    let workout;

    try {
      workout =
        JSON.parse(text);

      await logRuntimeEvent({
        executionId,

        agentId:
          "farm-strong",

        level: "info",

        step:
          "json_parse",

        message:
          "Model response parsed successfully",
      });

    } catch (error) {

      await logRuntimeEvent({
        executionId,

        agentId:
          "farm-strong",

        level: "error",

        step:
          "json_parse",

        message:
          "Invalid JSON returned by model",
      });

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

    await logRuntimeEvent({
      executionId,

      agentId:
        "farm-strong",

      level: "info",

      step:
        "draft_creation",

      message:
        "Workout draft created",

      metadata: {
        draftId,
      },
    });

    /**
     * Execution Log
     */

    const completedAt =
      new Date();

    await logRuntimeEvent({
      executionId,

      agentId:
        "farm-strong",

      level: "info",

      step:
        "completed",

      message:
        "Execution completed successfully",
    });

    return res.status(200).json({
      workout,
      draftId,
      executionId,
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

    const completedAt =
      new Date();

    await logExecution({
      executionId,
    
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

    await logRuntimeEvent({
      executionId,

      agentId:
        "farm-strong",

      level: "error",

      step:
        "execution_failed",

      message:
        error?.message ||
        "Unknown error",
    });

    return res.status(500).json({
      error:
        error?.message ||
        "Failed to generate workout",
    });
  }
}
