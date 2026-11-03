import firestore from "../firestoreClient";

/**
 * =====================================================
 * AGENT RUNTIME LOGGER
 * =====================================================
 *
 * Purpose
 * -------
 *
 * Records individual runtime events
 * that occur during agent execution.
 *
 * One execution can have many runtime logs.
 *
 * Example
 * -------
 *
 * Execution
 * ├── Agent Loaded
 * ├── Context Built
 * ├── Tool Called
 * ├── Prompt Generated
 * └── Response Parsed
 *
 * Future
 * -------
 *
 * - OpenTelemetry
 * - Distributed Tracing
 * - Cost Analysis
 * - API Monitoring
 * - Multi-Agent Workflow Tracking
 *
 */

export interface RuntimeEvent {
  executionId: string;

  agentId: string;

  level:
    | "info"
    | "warning"
    | "error";

  step: string;

  message: string;

  metadata?: any;

  durationMs?: number;
}

export async function logRuntimeEvent(
  event: RuntimeEvent
) {
  try {
    await firestore
      .collection(
        "agent_runtime_logs"
      )
      .add({
        ...event,

        timestamp:
          new Date(),

        createdAt:
          new Date(),
      });

  } catch (error) {

    console.error(
      "[RUNTIME LOG ERROR]",
      error
    );

  }
}
