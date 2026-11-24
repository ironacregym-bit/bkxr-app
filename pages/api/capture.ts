import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import {
  getCaptureFormConfig,
} from "../../packages/workflow-engine/src/getCaptureFormConfig";

import {
  createCaptureRecord,
} from "../../packages/workflow-engine/src/createCaptureRecord";

import {
  createWorkflowRun,
} from "../../packages/workflow-engine/src/createWorkflowRun";

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
      formId,
      payload,
    } = req.body;

    const config =
      await getCaptureFormConfig(
        formId
      );

    const recordId =
      await createCaptureRecord({
        collectionName:
          config.targetCollection,

        payload,
      });

    const workflowRunId =
      await createWorkflowRun({
        tenantId:
          config.tenantId,

        workflowId:
          config.workflowId,

        payload: {
          recordId,
          formId,
        },
      });

    return res.status(200).json({
      success: true,

      recordId,

      workflowRunId,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unknown error",
    });
  }
}
