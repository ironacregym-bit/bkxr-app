import { createGoogleGenerativeAI }
  from "@ai-sdk/google";

const googleAI =
  createGoogleGenerativeAI({
    apiKey:
      process.env.GEMINI_API_KEY,
  });

export function getAgentModel(
  agent: any
) {
  switch (agent.provider) {
    case "google":
      return googleAI(
        agent.model
      );

    default:
      return googleAI(
        "gemini-2.5-flash"
      );
  }
}
