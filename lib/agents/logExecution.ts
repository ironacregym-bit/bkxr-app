import firestore
  from "../firestoreClient";

/**
 * =====================================================
 * AGENT EXECUTION LOGGER
 * =====================================================
 *
 * Purpose
 * -------
 *
 * Records every agent execution.
 *
 * Enables:
 *
 * - Audit Trails
 * - Usage Tracking
 * - Cost Analysis
 * - Monitoring
 * - Multi-Agent Observability
 *
 * Future
 * -------
 *
 * - Token Tracking
 * - Cost Calculations
 * - User Tracking
 * - Tenant Tracking
 * - Workflow Tracking
 *
 */

export interface LogExecutionInput {
  agentId: string;

  agentName: string;

  executionType: string;

  status: string;

  startedAt: Date;

  completedAt: Date;

  durationMs: number;

  toolsUsed: string[];

  input?: any;

  outputSummary?: any;

  draftId?: string;
}

export async function logExecution(
  execution: LogExecutionInput
) {
  try {
    await firestore
      .collection(
        "agent_executions"
      )
      .add({
        ...execution,

        createdAt:
          new Date(),
      });

  } catch (error) {
    console.error(
      "[EXECUTION LOG ERROR]",
      error
    );
  }
}
