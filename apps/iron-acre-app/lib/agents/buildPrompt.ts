import { AIAgent } from "./loadAgent";

/**
 * Builds the final agent prompt.
 *
 * The agent definition is loaded from Firestore.
 *
 * Prompt Structure:
 *
 * 1. System Prompt
 * 2. Retrieved Tool Context
 * 3. Agent Rules
 * 4. User Request
 * 5. Required Output Schema
 *
 * The goal is to return structured JSON
 * rather than a large text response.
 */
export function buildPrompt(
  agent: AIAgent,
  agentContext: string,
  userInput: {
    classType: string;
    classSize: number;
    duration: number;
    format: string;
    focus: string;
    requirements: string;
  }
) {
  return `
${agent.system_prompt}

AGENT CONTEXT

${agentContext}

RULES

${agent.rules
  .map((rule) => `- ${rule}`)
  .join("\n")}

CLASS DETAILS

Class Type:
${userInput.classType}

Class Size:
${userInput.classSize}

Duration:
${userInput.duration} minutes

Format:
${userInput.format}

Focus:
${userInput.focus}

Requirements:
${userInput.requirements}

IMPORTANT

You MUST only use approved exercises from the exercise library provided in the agent context.

You MUST respect equipment availability.

You MUST avoid recently used workout structures where possible.

You MUST create a workout suitable for real-world delivery.

RESPONSE FORMAT

Return ONLY valid JSON.

Do NOT wrap the response in markdown.

Do NOT include explanation text.

The JSON schema must exactly match:

{
  "title": "string",
  "overview": "string",

  "warmup": [
    {
      "exercise": "string",
      "instructions": "string"
    }
  ],

  "strength": [
    {
      "exercise": "string",
      "sets": "string",
      "reps": "string",
      "instructions": "string"
    }
  ],

  "conditioning": [
    {
      "exercise": "string",
      "instructions": "string"
    }
  ],

  "core": [
    {
      "exercise": "string",
      "instructions": "string"
    }
  ],

  "cooldown": [
    {
      "exercise": "string",
      "instructions": "string"
    }
  ],

  "coach_notes": [
    "string"
  ]
}
`;
}
