
// lib/notifications/store.ts
import firestore from "../firestoreClient";

export async function writeUserNotification(
  email: string,
  opts: {
    title: string;
    message: string;
    href?: string;
    channels: string[];
    source_key: string;
    source_event?: string;
    throttle_seconds?: number;
    force?: boolean;
    meta?: any;
    /** NEW: time-to-live (seconds). Defaults to 24 hours if not provided */
    ttl_seconds?: number;
    /** NEW: override expiry instant explicitly (ISO). If provided, ignores ttl_seconds */
    expires_at?: string | null;
  }
) {
  const coll = firestore.collection("user_notifications").doc(email).collection("items");

  const throttle = Number(opts.throttle_seconds || 0);
  if (throttle > 0 && !opts.force) {
    const lastQ = await coll
      .where("source_key", "==", opts.source_key)
      .orderBy("created_at", "desc")
      .limit(1)
      .get();
    if (!lastQ.empty) {
      const last = lastQ.docs[0].data();
      const lastTs = Date.parse(last.created_at || "");
      if (!isNaN(lastTs)) {
        const deltaSec = (Date.now() - lastTs) / 1000;
        if (deltaSec < throttle) return null;
      }
    }
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // NEW: expiry
  const ttl = Number.isFinite(Number(opts.ttl_seconds)) ? Number(opts.ttl_seconds) : 86400; // 24h
  const expiresIso =
    typeof opts.expires_at === "string" && opts.expires_at.trim()
      ? opts.expires_at
      : new Date(now.getTime() + ttl * 1000).toISOString();

  const doc = {
    title: opts.title,
    message: opts.message,
    href: opts.href || null,
    created_at: nowIso,
    read_at: null,
    delivered_channels: Array.isArray(opts.channels) && opts.channels.length ? opts.channels : ["in_app"],
    source_key: opts.source_key,
    source_event: opts.source_event || null,
    meta: opts.meta || null,
    // NEW: expiry field
    expires_at: expiresIso,
  };

  await coll.add(doc);
  return doc;
}
