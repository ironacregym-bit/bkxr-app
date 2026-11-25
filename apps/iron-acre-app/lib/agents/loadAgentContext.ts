import { toolRegistry } from "./toolRegistry";
import { AIAgent } from "./loadAgent";

/**
 * Executes all tools listed
 * on an agent definition.
 *
 * This allows agents to dynamically
 * choose which tools they need.
 */
export async function loadAgentContext(
  agent: AIAgent
) {
  const context: Record<
    string,
    any
  > = {};

  for (const toolName of agent.tools) {
    const tool =
      toolRegistry[
        toolName as keyof typeof toolRegistry
      ];

    if (!tool) {
      console.warn(
        `Tool not found: ${toolName}`
      );
      continue;
    }

    context[toolName] =
      await tool();
  }

  return context;
}
