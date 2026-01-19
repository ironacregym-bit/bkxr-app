
// lib/notifications/push.ts
import { webpush } from "../webPush";
import firestore from "../firestoreClient";

export async function sendPushIfOptedIn(email: string, payload: { title: string; body: string; url?: string }) {
  const doc = await firestore.collection("web_push_subscriptions").doc(email).get();
  const subs: any[] = (doc.exists && Array.isArray(doc.data()?.subs)) ? doc.data()!.subs : [];
  if (!subs.length) return { sent: 0 };

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
  });

  let sent = 0;
  const keep: any[] = [];
  for (const s of subs) {
    try { await webpush.sendNotification(s, data); keep.push(s); sent++; }
    catch (err: any) {
      const code = Number(err?.statusCode || 0);
      if (code !== 404 && code !== 410) keep.push(s); // prune invalid
    }
  }

  if (keep.length !== subs.length) {
    await firestore.collection("web_push_subscriptions").doc(email).set(
      { email, subs: keep, updated_at: new Date() },
      { merge: true }
    );
  }
  return { sent };
}
``
