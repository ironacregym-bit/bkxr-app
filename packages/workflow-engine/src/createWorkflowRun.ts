import firestore from "../../../../lib/firestoreClient";

export async function createWorkflowRun({
  tenantId,
  workflowId,
  payload,
}: {
  tenantId: string;
  workflowId: string;
  payload: Record<string, unknown>;
}) {
  const doc = await firestore
    .collection("workflow_runs")
    .add({
      tenantId,
      workflowId,

      status: "pending",

      currentStep: 0,

      payload,

      createdAt: new Date(),
      updatedAt: new Date(),
    });

  return doc.id;
}
