import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import {
  firestore,
} from "@pt/firebase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email is required",
      });
    }

    const doc =
      await firestore
        .collection(
          "iron-acre-web_leads"
        )
        .add({
          email,

          source:
            "landing-page",

          status:
            "new",

          createdAt:
            new Date(),
        });

    return res.status(200).json({
      success: true,
      leadId: doc.id,
    });

  } catch (error: any) {

    console.error(
      "[CREATE LEAD]",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Failed to save lead",
    });

  }
}
