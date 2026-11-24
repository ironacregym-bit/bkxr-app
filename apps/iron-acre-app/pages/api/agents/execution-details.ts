import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import firestore
  from "../../../lib/firestoreClient";

/**
 * =====================================================
 * EXECUTION DETAILS API
 * =====================================================
 *
 * Returns:
 * - Execution
 * - Runtime Events
 *
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { executionId } =
      req.query;

    if (!executionId) {
      return res.status(400).json({
        error:
          "executionId required",
      });
    }

    const executionSnapshot =
      await firestore
        .collection(
          "agent_executions"
        )
        .where(
          "executionId",
          "==",
          executionId
        )
        .limit(1)
        .get();

    const runtimeSnapshot =
      await firestore
        .collection(
          "agent_runtime_logs"
        )
        .where(
          "executionId",
          "==",
          executionId
        )
        .orderBy(
          "timestamp",
          "asc"
        )
        .get();

    const execution =
      executionSnapshot.docs[0]
        ?.data() || null;

    const runtimeLogs =
      runtimeSnapshot.docs.map(
        (doc) => ({
          id: doc.id,
          ...doc.data(),
        })
      );

    return res.status(200).json({
      execution,
      runtimeLogs,
    });

  } catch (error: any) {

    return res.status(500).json({
      error:
        error.message,
    });

  }
}
