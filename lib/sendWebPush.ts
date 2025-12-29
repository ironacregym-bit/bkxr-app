
// lib/sendWebPush.ts
import firestore from "./firestoreClient";
import { webpush } from "./webPush";

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  data?: Record<string, string>;
};

type SendResult = {
  ok: true;
  sent: number;
  failed: number;
  pruned?: string[]; // last 10 chars of pruned endpoints for quick diagnostics
};

export async function sendToUser(email: string, payload: PushPayload): Promise<SendResult> {
  const doc = await firestore.collection("web_push_subscriptions").doc(email).get();
  const subs: any[] = (doc.exists && Array.isArray(doc.data()?.subs)) ? (doc.data()!.subs as any[]) : [];
  if (subs.length === 0) return { ok: true, sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  const stillValid: any[] = [];
  const prunedTails: string[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
      sent++;
      stillValid.push(sub);
    } catch (err: any) {
      failed++;

      const status = Number(err?.statusCode ?? NaN);
      const endpointTail = typeof sub?.endpoint === "string"
        ? sub.endpoint.slice(-10)
        : "unknown-endpoint";

      // Log a compact diagnostic to server logs
      console.warn("[push] send failed", {
        status: Number.isNaN(status) ? "n/a" : status,
        endpointTail,
        message: err?.message,
      });

      // Prune clearly invalid subscriptions: any 4xx (401/403/404/410/etc.)
      const isClientError = !Number.isNaN(status) && status >= 400 && status < 500;
      if (isClientError) {
        prunedTails.push(endpointTail);
        // do not push sub back to stillValid
      } else {
        // Keep transient server errors (5xx or unknown) so future sends can retry
        stillValid.push(sub);
      }
    }
  }

  // Write back pruned list if any failures occurred
  if (failed > 0) {
    await firestore
      .collection("web_push_subscriptions")
      .doc(email)
      .set({ subs: stillValid }, { merge: true });
  }

  return prunedTails.length > 0
    ? { ok: true, sent, failed, pruned: prunedTails }
    : { ok: true, sent, failed };
}
