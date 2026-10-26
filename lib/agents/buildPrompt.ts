import { AIAgent } from "./loadAgent";

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

OUTPUT FORMAT

${agent.output_sections.join("\n")}
`;
}
