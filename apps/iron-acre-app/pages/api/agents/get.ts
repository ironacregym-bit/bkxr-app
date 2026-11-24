import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import firestore
  from "../../../lib/firestoreClient";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { id } = req.query;

    const doc =
      await firestore
        .collection(
          "ai_agents"
        )
        .doc(String(id))
        .get();

    if (!doc.exists) {
      return res.status(404).json({
        error:
          "Agent not found",
      });
    }

    return res.status(200).json({
      agent: {
        id: doc.id,
        ...doc.data(),
      },
    });

  } catch (error: any) {

    return res.status(500).json({
      error:
        error.message,
    });

  }
}
