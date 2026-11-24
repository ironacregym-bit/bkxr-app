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
    const {
      id,
      ...agent
    } = req.body;

    await firestore
      .collection(
        "ai_agents"
      )
      .doc(id)
      .update({
        ...agent,
        updated_at:
          new Date(),
      });

    return res.status(200).json({
      success: true,
    });

  } catch (error: any) {

    return res.status(500).json({
      error:
        error.message,
    });

  }
}
