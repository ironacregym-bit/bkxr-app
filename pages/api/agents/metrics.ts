import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import firestore
  from "../../../lib/firestoreClient";

/**
 * =====================================================
 * AGENT METRICS API
 * =====================================================
 *
 * Platform level statistics.
 *
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const executionSnapshot =
      await firestore
        .collection(
          "agent_executions"
        )
        .get();

    const tokenSnapshot =
      await firestore
        .collection(
          "agent_token_usage"
        )
        .get();

    const executions =
      executionSnapshot.docs.map(
        (doc) => doc.data()
      );

    const tokenUsage =
      tokenSnapshot.docs.map(
        (doc) => doc.data()
      );

    const successfulRuns =
      executions.filter(
        (e) =>
          e.status ===
          "success"
      );

    const totalExecutions =
      executions.length;

    const successRate =
      totalExecutions === 0
        ? 0
        : (
            (successfulRuns.length /
              totalExecutions) *
            100
          ).toFixed(2);

    const averageDuration =
      totalExecutions === 0
        ? 0
        : Math.round(
            executions.reduce(
              (
                total,
                current
              ) =>
                total +
                (current.durationMs ||
                  0),
              0
            ) /
              totalExecutions
          );

    const totalTokens =
      tokenUsage.reduce(
        (
          total,
          current
        ) =>
          total +
          (current.totalTokens ||
            0),
        0
      );

    const estimatedCost =
      tokenUsage.reduce(
        (
          total,
          current
        ) =>
          total +
          (current.estimatedCost ||
            0),
        0
      );

    return res.status(200).json({
      totalExecutions,

      successRate,

      averageDuration,

      totalTokens,

      estimatedCost,
    });

  } catch (error: any) {

    return res.status(500).json({
      error:
        error.message,
    });

  }
}
