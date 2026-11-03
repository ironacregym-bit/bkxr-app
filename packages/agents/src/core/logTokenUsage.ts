import firestore from "../firestoreClient";

/**
 * =====================================================
 * AGENT TOKEN LOGGER
 * =====================================================
 *
 * Records token consumption and
 * estimated AI cost per execution.
 *
 * This becomes the foundation of:
 *
 * - Cost Tracking
 * - Tenant Billing
 * - Usage Analytics
 * - Rate Monitoring
 *
 */

export interface TokenUsageLog {
  executionId: string;

  agentId: string;

  agentName: string;

  model: string;

  promptTokens: number;

  completionTokens: number;

  totalTokens: number;

  estimatedCost: number;
}

export async function logTokenUsage(
  usage: TokenUsageLog
) {
  try {
    await firestore
      .collection(
        "agent_token_usage"
      )
      .add({
        ...usage,

        createdAt:
          new Date(),
      });

  } catch (error) {

    console.error(
      "[TOKEN LOG ERROR]",
      error
    );

  }
}
