import { firestore } from "@pt/firebase";

export async function createCaptureRecord({
  collectionName,
  payload,
}: {
  collectionName: string;

  payload: Record<
    string,
    unknown
  >;
}) {
  const doc =
    await firestore
      .collection(
        collectionName
      )
      .add({
        ...payload,

        status: "new",

        createdAt:
          new Date(),
      });

  return doc.id;
}
