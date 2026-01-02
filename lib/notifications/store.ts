
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
  }
) {
  const coll = firestore.collection("user_notifications").doc(email).collection("items");

  const throttle = Number(opts.throttle_seconds || 0);
  if (throttle > 0 && !opts.force) {
    const lastQ = await coll.where("source_key", "==", opts.source_key).orderBy("created_at", "desc").limit(1).get();
    if (!lastQ.empty) {
      const last = lastQ.docs[0].data();
      const lastTs = Date.parse(last.created_at || "");
      if (!isNaN(lastTs)) {
        const deltaSec = (Date.now() - lastTs) / 1000;
        if (deltaSec < throttle) return null;
      }
    }
  }

  const nowIso = new Date().toISOString();
  const doc = {
    title: opts.title,
    message: opts.message,
    href: opts.href || null,
    created_at: nowIso,
    read_at: null,
    delivered_channels: opts.channels || ["in_app"],
    source_key: opts.source_key,
    source_event: opts.source_event || null,
    meta: opts.meta || null,
  };

   await coll.add(doc);
  return doc;
}
