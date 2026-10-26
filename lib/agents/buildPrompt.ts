import { AIAgent } from "./loadAgent";

/**
 * Builds a complete prompt from:
 *
 * 1. Agent definition
 * 2. Retrieved Firestore context
 * 3. User request
 *
 * This allows agent behaviour to be
 * controlled from Firestore instead
 * of being hardcoded into API routes.
 */
export function buildPrompt(
  agent: AIAgent,
  context: {
    equipmentText: string;
    recentWorkoutText: string;
    exerciseText: string;
  },
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

AVAILABLE EQUIPMENT

${context.equipmentText}

RECENT WORKOUT HISTORY

${context.recentWorkoutText}

APPROVED EXERCISES

${context.exerciseText}

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

SPECIAL REQUIREMENTS

${userInput.requirements}

OUTPUT FORMAT

${agent.output_sections.join("\n")}
`;
}
