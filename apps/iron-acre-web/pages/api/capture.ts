import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import {
  getCaptureFormConfig,
} from "../../../../packages/workflow-engine/src/getCaptureFormConfig";

import {
  createCaptureRecord,
} from "../../../../packages/workflow-engine/src/createCaptureRecord";

import {
  createWorkflowRun,
} from "../../../../packages/workflow-engine/src/createWorkflowRun";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const formId =
      typeof req.body?.formId === "string"
        ? req.body.formId.trim()
        : "";
    const payload = req.body?.payload;

    if (
      !formId ||
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      return res.status(400).json({
        error: "A form ID and lead details are required",
      });
    }

    const name =
      typeof payload.name === "string"
        ? payload.name.trim()
        : "";
    const email =
      typeof payload.email === "string"
        ? payload.email.trim().toLowerCase()
        : "";
    const source =
      typeof payload.source === "string"
        ? payload.source.trim().slice(0, 80)
        : formId;

    if (
      !name ||
      name.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254
    ) {
      return res.status(400).json({
        error: "Enter a valid name and email address",
      });
    }

    const config =
      await getCaptureFormConfig(
        formId
      );
    const collectionName =
      typeof config.targetCollection === "string"
        ? config.targetCollection.trim()
        : "";

    if (!collectionName) {
      throw new Error(
        `Capture form config has no target collection: ${formId}`
      );
    }

    const recordId =
      await createCaptureRecord({
        collectionName,
        payload: {
          ...payload,
          name,
          email,
          source,
        },
      });

    const workflowRunId =
      await createWorkflowRun({
        tenantId:
          config.tenantId,

        workflowId:
          config.workflowId,

        payload: {
          leadId: recordId,
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
