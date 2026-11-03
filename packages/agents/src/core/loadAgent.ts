import firestore from "../firestoreClient";

/**
 * Represents an AI agent definition
 * stored in Firestore.
 *
 * Agent behaviour should be driven
 * by data, not hardcoded prompts.
 */
export interface AIAgent {
  name: string;
  active: boolean;
  model: string;

  system_prompt: string;

  rules: string[];

  tools: string[];

  requires_approval: boolean;

  output_sections: string[];
}

/**
 * Loads an AI agent definition
 * from Firestore.
 *
 * Example:
 *
 * await loadAgent("farm-strong");
 */
export async function loadAgent(
  agentId: string
): Promise<AIAgent> {
  const snapshot = await firestore
    .collection("ai_agents")
    .doc(agentId)
    .get();

  if (!snapshot.exists) {
    throw new Error(
      `Agent not found: ${agentId}`
    );
  }

  return snapshot.data() as AIAgent;
}
