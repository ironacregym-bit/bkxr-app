import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import firestore from "../../../../../lib/firestoreClient";

import { createWorkflowRun } from "../../../../../packages/workflow-engine/src/create-workflow-run";

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
    const {
      name,
      email,
      source = "hero",
    } = req.body;

    if (!name || !email) {
      return res.status(
        400
      ).json({
        error:
          "Name and email are required",
      });
    }

    const lead =
      await firestore
        .collection(
          "iron-acre-web_leads"
        )
        .add({
          name,
          email,
          source,

          status: "new",

          createdAt:
            new Date(),
        });

    await createWorkflowRun({
      tenantId:
        "iron-acre",

      workflowId:
        "lead-onboarding",

      payload: {
        leadId: lead.id,
      },
    });

    return res.status(
      200
    ).json({
      success: true,
      id: lead.id,
    });
  } catch (error) {
    console.error(error);

    return res.status(
      500
    ).json({
      error:
        "Failed to create lead",
    });
  }
}
