import firestore from "../../../../lib/firestoreClient";

export async function getPendingWorkflowRuns() {
  const snapshot =
    await firestore
      .collection("workflow_runs")
      .where(
        "status",
        "==",
        "pending"
      )
      .get();

  return snapshot.docs.map(
    (doc) => ({
      id: doc.id,
      ...doc.data(),
    })
  );
}
