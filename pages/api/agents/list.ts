import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import firestore
  from "../../../lib/firestoreClient";

/**
 * =====================================================
 * LIST AGENTS API
 * =====================================================
 *
 * Returns all agent definitions
 * from Firestore.
 *
 * Used by:
 *
 * /admin/ai-agents
 *
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const snapshot =
      await firestore
        .collection(
          "ai_agents"
        )
        .get();

    const agents =
      snapshot.docs.map(
        (doc) => ({
          id: doc.id,
          ...doc.data(),
        })
      );

    return res.status(200).json({
      agents,
    });

  } catch (error: any) {

    return res.status(500).json({
      error:
        error.message ||
        "Failed to load agents",
    });

  }
}
