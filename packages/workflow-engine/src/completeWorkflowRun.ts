import { firestore } from "@pt/firebase";

export async function completeWorkflowRun(
  workflowRunId: string
) {
  await firestore
    .collection("workflow_runs")
    .doc(workflowRunId)
    .update({
      status: "completed",
      updatedAt: new Date(),
    });
}
