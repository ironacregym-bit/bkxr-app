
// lib/notifications/store.ts
import firestore from "../firestoreClient";

type WriteArgs = {
  title: string;
  message: string;
  href?: string | null;
  channels: ("in_app" | "push" | "email")[];
  source_key?: string;
  source_event?: string;
  throttle_seconds?: number;
  expires_in_hours?: number;
  force?: boolean;
  meta?: Record<string, any> | null;
};

function isoNow() { return new Date().toISOString(); }
function expiresAt(hours?: number) {
  if (!hours || hours <= 0) return null;
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

async function throttled(
  email: string,
  source_key?: string,
  source_event?: string,
  throttle_seconds?: number,
  force?: boolean
) {
  if (force) return false;
  if (!throttle_seconds || throttle_seconds <= 0) return false;
  const since = Date.now() - throttle_seconds * 1000;

  const coll = firestore.collection("user_notifications").doc(email).collection("items");
  const snap = await coll.orderBy("created_at", "desc").limit(10).get();
  for (const d of snap.docs) {
    const x = d.data() as any;
    if (x.source_key !== source_key || x.source_event !== source_event) continue;
    const createdIso =
      typeof x.created_at === "string" ? x.created_at : x.created_at?.toDate?.()?.toISOString?.() || "";
    const createdMs = Date.parse(createdIso);
    if (!isNaN(createdMs) && createdMs >= since) return true;
  }
  return false;
}

export async function writeUserNotification(email: string, args: WriteArgs) {
  const {
    title, message, href = null, channels,
    source_key = null, source_event = null,
    throttle_seconds = 0, expires_in_hours = 0,
    force = false, meta = null,
  } = args;

  const skip = await throttled(email, source_key || undefined, source_event || undefined, throttle_seconds, force);
  if (skip) return null;

  const expAt = expiresAt(expires_in_hours);
  const doc = {
    title,
    message,
    href,
    created_at: isoNow(),
    read_at: null,
    expires_at: expAt,
    delivered_channels: channels,
    source_key,
    source_event,
    meta,
  };

  const ref = firestore.collection("user_notifications").doc(email).collection("items").doc();
  await ref.set(doc);
  return doc;
}
