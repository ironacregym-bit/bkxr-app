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

    const agent =
      await loadAgent("farm-strong");

    const context =
      await loadAgentContext(agent);

    const agentContext =
      buildContext(context);

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

    const { text } =
      await generateText({
        model: getAgentModel(agent),
        prompt,
      });

    let workout;

    try {
      workout = JSON.parse(text);
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

        workout,

        toolContext:
          context,

        status:
          "draft",
      });

    return res.status(200).json({
      workout,
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
