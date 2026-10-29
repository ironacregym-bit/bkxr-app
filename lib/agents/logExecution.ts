import firestore
  from "../firestoreClient";

/**
 * =====================================================
 * AGENT EXECUTION LOGGER
 * =====================================================
 *
 * Records one execution per run.
 *
 * Runtime logs are separate and
 * linked by executionId.
 *
 */

export interface LogExecutionInput {
  executionId: string;

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
