import {
  firestore,
} from "@pt/firebase";

export async function saveLead(
  email: string
) {
  const doc =
    await firestore
      .collection("leads")
      .add({
        email,

        source:
          "iron-acre-web",

        status:
          "new",

        createdAt:
          new Date(),
      });

  return doc.id;
}
