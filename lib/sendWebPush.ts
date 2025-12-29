
// lib/sendWebPush.ts
import firestore from "./firestoreClient";
import { webpush } from "./webPush";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  data?: Record<string, string>;
};

export async function sendToUser(email: string, payload: PushPayload) {
  const doc = await firestore.collection("web_push_subscriptions").doc(email).get();
  const subs: any[] = (doc.exists && Array.isArray(doc.data()?.subs)) ? doc.data()!.subs : [];
  if (subs.length === 0) return { ok: true, sent: 0, failed: 0 };

  let success = 0;
  let failure = 0;
  const stillValid: any[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      success++;
      stillValid.push(sub);
    } catch (err: any) {
      failure++;
      // Permanently-gone endpoints are 404/410 — prune them
      const status = String(err?.statusCode || "");
      const gone = status === "404" || status === "410";
      if (!gone) stillValid.push(sub); // keep transient failures
    }
  }

  await firestore.collection("web_push_subscriptions").doc(email).set({ subs: stillValid }, { merge: true });
  return { ok: true, sent: success, failed: failure };
}
