import { firestore } from "@pt/firebase";

export async function claimWorkflowRun(
  workflowRunId: string
) {
  await firestore
    .collection("workflow_runs")
    .doc(workflowRunId)
    .update({
      status: "running",
      updatedAt: new Date(),
    });
}
