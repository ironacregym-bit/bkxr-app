
import firestore from "../firestoreClient";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mod = require("../sendWebPush");
const sendToUser = mod.sendToUser || mod.default;

export async function sendPushIfOptedIn(email: string, payload: { title: string; body: string; url?: string | null }) {
  try {
    const userSnap = await firestore.collection("users").doc(email).get();
    const user = userSnap.exists ? userSnap.data() : {};
    const opted = !!user?.notifications_opt_in;
    if (!opted) return;
    await sendToUser(email, payload);
  } catch (e) {
    console.error("[push/send] error:", e);
   }
}
