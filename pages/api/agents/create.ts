import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import firestore
  from "../../../lib/firestoreClient";

/**
 * =====================================================
 * CREATE AGENT API
 * =====================================================
 *
 * Creates a new Agent Definition.
 *
 * Agents are stored in:
 *
 * ai_agents
 *
 * Future:
 *
 * - Tenant ownership
 * - Cost controls
 * - Permissions
 * - Templates
 *
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }

    const {
      id,
      name,
      description,
      agent_type,
      provider,
      model,
      system_prompt,
      tools,
      rules,
    } = req.body;

    if (!id || !name) {
      return res.status(400).json({
        error:
          "Agent id and name are required",
      });
    }

    await firestore
      .collection("ai_agents")
      .doc(id)
      .set({
        name,

        description:
          description || "",

        active: true,

        provider:
          provider || "google",

        model:
          model ||
          "gemini-2.5-flash",

        agent_type:
          agent_type || "custom",

        response_format:
          "json",

        tools:
          tools || [],

        rules:
          rules || [],

        system_prompt:
          system_prompt || "",

        created_at: new Date(),

        updated_at: new Date(),
      });

    return res.status(200).json({
      success: true,
    });

  } catch (error: any) {

    return res.status(500).json({
      error:
        error.message ||
        "Failed to create agent",
    });

  }
}
