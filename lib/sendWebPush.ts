
// lib/sendWebPush.ts
import firestore from "./firestoreClient";
import webpush from "./webPush";

export type PushPayload = {
  title: string;
  body: string;
  url?: string  url?: string;
  data?: Record<string, string>;
};

export async function sendToUser(email: string, payload: PushPayload) {
  const doc = await firestore.collection("web_push_subscriptions").doc(email).get();
  const subs: any[] = (doc.exists && Array.isArray(doc.data()?.subs)) ? doc.data()!.subs : [];
  if (subs.length === 0) return { ok: true, sent: 0 };

  let success = 0, failure = 0;
  const stillValid: any[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      success++;
      stillValid.push(sub);
    } catch (err: any) {
      failure++;
      // Prune permanently gone endpoints (410/404)
      const status = err?.statusCode;
      if (!(String(status) === "410" || String(status) === "404")) {
        stillValid.push(sub); // keep transient errors
      }
    }
  }

  await firestore.collection("web_push_subscriptions").doc(email).set({ subs: stillValid }, { merge: true });
  return { ok: true, sent: success, failed: failure };
}
