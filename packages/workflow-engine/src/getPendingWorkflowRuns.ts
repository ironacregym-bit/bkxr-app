import { firestore } from "@pt/firebase";

export async function getPendingWorkflowRuns() {
  const snapshot =
    await firestore
      .collection("workflow_runs")
      .where(
        "status",
        "==",
        "pending"
      )
      .limit(25)
      .get();

  return snapshot.docs.map(
    (doc) => ({
      id: doc.id,
      ...doc.data(),
    })
  );
}
