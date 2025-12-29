
// lib/messenger.ts
import firestore from "./firestoreClient";
import { renderObjectStrings, renderString } from "./template";
import { sendToUser } from "./sendWebPush";
import { Timestamp } from "@google-cloud/firestore";

type TemplateDoc = {
  key: string;
  enabled: boolean;
  title_template: string;
  body_template: string;
  url_template?: string;
  data_template?: Record<string, string>;
  channels?: string[];
  throttle_seconds?: number;
};

async function loadTemplate(key: string): Promise<TemplateDoc | null> {
  const doc = await firestore.collection("notification_templates").doc(key).get();
  return doc.exists ? ({ key: doc.id, ...(doc.data() as any) } as TemplateDoc) : null;
}

async function lastSentAt(email: string, key: string): Promise<Date | null> {
  const snap = await firestore
    .collection("notification_logs")
    .where("email", "==", email)
    .where("template_key", "==", key)
    .orderBy("created_at", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0].data().created_at;
  if (!d) return null;
  return typeof (d as any)?.toDate === "function" ? (d as any).toDate() : new Date(d);
}

async function isOptedIn(email: string): Promise<boolean> {
  const doc = await firestore.collection("users").doc(email).get();
  const u = (doc.exists ? doc.data() : {}) || {};
  // default to true if not set
  return u.notifications_opt_in !== false;
}

export async function sendScenario(params: {
  email: string;
  key: string;
  context?: Record<string, any>;
  force?: boolean;
}) {
  const { email, key, context = {}, force = false } = params;

  const tmpl = await loadTemplate(key);
  if (!tmpl || !tmpl.enabled) {
    await log(email, key, { status: "skipped", error: "template_disabled_or_missing" });
    return { ok: true, sent: 0, failed: 0, skipped: 1 };
  }

  const opted = await isOptedIn(email);
  if (!opted) {
    await log(email, key, { status: "skipped", error: "user_opted_out" });
    return { ok: true, sent: 0, failed: 0, skipped: 1 };
  }

  const now = Date.now();
   const last = await lastSentAt(email, key);
  const throttleSec = Number(tmpl.throttle_seconds ?? 0);
  if (!force && throttleSec > 0 && last && now - last.getTime() < throttleSec * 1000) {
    await log(email, key, { status: "skipped", error: "throttled" });
    return { ok: true, sent: 0, failed: 0, skipped: 1 };
  }

  // Render payload
  const title = renderString(tmpl.title_template || "", context);
  const body = renderString(tmpl.body_template || "", context);
  const url = tmpl.url_template ? renderString(tmpl.url_template, context) : "/";
  const data = tmpl.data_template ? renderObjectStrings(tmpl.data_template, context) : undefined;

  // Only push channel for now
  let sent = 0, failed = 0, errMsg = "";

  try {
    const resp = await sendToUser(email, { title, body, url, data });
    sent += resp.sent;
    failed += resp.failed;
    if (failed > 0) errMsg = "push_failed";
  } catch (e: any) {
    failed++;
    errMsg = e?.message || "push_exception";
  }

  // Log
  await log(email, key, {
    status: failed > 0 ? "failed" : "sent",
    title,
    body,
    url,
    data,
    error: errMsg || undefined,
  });

  return { ok: true, sent, failed };
}

async function log(
  email: string,
  template_key: string,
  extra: Partial<{
    status: "sent" | "failed" | "skipped";
    title: string;
    body: string;
    url?: string;
    data?: Record<string, any>;
    error?: string;
  }>
) {
  const doc = {
    email,
    template_key,
    ...extra,
    created_at: Timestamp.now(),
  };
  await firestore.collection("notification_logs").add(doc);
}
