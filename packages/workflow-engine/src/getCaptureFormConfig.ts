import { firestore } from "@pt/firebase";

export async function getCaptureFormConfig(
  formId: string
) {
  const snapshot =
    await firestore
      .collection(
        "capture_form_configs"
      )
      .where(
        "formId",
        "==",
        formId
      )
      .limit(1)
      .get();

  if (snapshot.empty) {
    throw new Error(
      `Capture form config not found: ${formId}`
    );
  }

  return snapshot.docs[0].data();
}
