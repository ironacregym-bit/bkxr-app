import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import {
  getPendingWorkflowRuns,
} from "../../../packages/workflow-engine/src/getPendingWorkflowRuns";

import {
  claimWorkflowRun,
} from "../../../packages/workflow-engine/src/claimWorkflowRun";

import {
  completeWorkflowRun,
} from "../../../packages/workflow-engine/src/completeWorkflowRun";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const cronKey =
    req.headers["x-cron-key"];

  if (
    cronKey !== process.env.CRON_KEY
  ) {
    return res.status(401).json({
      error: "Unauthorised",
    });
  }

  const runs =
    await getPendingWorkflowRuns();

  for (const run of runs) {
    if (!run.id) {
      continue;
    }

    await claimWorkflowRun(
      run.id
    );

    await completeWorkflowRun(
      run.id
    );
  }

  return res.status(200).json({
    success: true,
    processed:
      runs.length,
  });
}
