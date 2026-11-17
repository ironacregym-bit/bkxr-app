import firestore from "../../../../lib/firestoreClient";

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
