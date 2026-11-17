import firestore from "../../../../lib/firestoreClient";

export async function failWorkflowRun(
  workflowRunId: string,
  error: string
) {
  await firestore
    .collection("workflow_runs")
    .doc(workflowRunId)
    .update({
      status: "failed",

      lastError: error,

      updatedAt: new Date(),
    });
}
