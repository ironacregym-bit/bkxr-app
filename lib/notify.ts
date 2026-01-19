
// lib/notify.ts
import firestore from "./firestoreClient";
import { webpush } from "./webPush";

type InAppPayload = {
  title: string;
  message: string;
  href?: string | null;
  expires_at?: string | null;
  source_key?: string;
  source_event?: string | null;
  meta?: Record<string, any> | null;
};

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
};

const USE_NOTIFY_API = process.env.USE_NOTIFY_API === "1";
const NEXT_BASE = process.env.NEXTAUTH_URL || "";

// —— Option A: direct Firestore write (default) ————————————————
async function pushInAppDirect(email: string, payload: InAppPayload) {
  const nowIso = new Date().toISOString();
  const ref = firestore.collection("user_notifications").doc(email).collection("items");
  await ref.add({
    ...payload,
    created_at: nowIso,
    read_at: null,
    delivered_channels: ["in_app", "push"],
  });
}

// —— Option B: call your existing notify API (plug-in) ——————————
// If your /api/notify/emit accepts a JSON body like {email, title, message, href, ...},
// flip USE_NOTIFY_API=1 and adjust the payload mapping here.
async function pushInAppViaApi(email: string, payload: InAppPayload) {
  if (!NEXT_BASE) return pushInAppDirect(email, payload);
  await fetch(`${NEXT_BASE}/api/notify/emit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-key": process.env.CRON_KEY || "" },
    body: JSON.stringify({ email, ...payload }),
  }).catch(() => null);
}

async function pushInApp(email: string, payload: InAppPayload) {
  return USE_NOTIFY_API ? pushInAppViaApi(email, payload) : pushInAppDirect(email, payload);
}

async function sendWebPushToUser(email: string, push: PushPayload) {
  const doc = await firestore.collection("web_push_subscriptions").doc(email).get();
  const subs: any[] = (doc.exists && Array.isArray(doc.data()?.subs)) ? doc.data()!.subs : [];
  if (!subs.length) return;

  const payload = JSON.stringify({
    title: push.title,
    body: push.body,
    url: push.url,
    icon: push.icon || "/icons/icon-192.png",
    badge: push.badge || "/icons/badge-72.png",
  });

  const keep: any[] = [];
  for (const s of subs) {
    try {
      await webpush.sendNotification(s, payload);
      keep.push(s);
    } catch (err: any) {
      const status = Number(err?.statusCode || 0);
      // prune only invalid subscriptions
      if (status !== 404 && status !== 410) keep.push(s);
    }
  }
  if (keep.length !== subs.length) {
    await firestore.collection("web_push_subscriptions").doc(email).set(
      { email, subs: keep, updated_at: new Date() },
      { merge: true }
    );
  }
}

export async function notifyInAppAndPush(email: string, inApp: InAppPayload, push?: PushPayload) {
  await pushInApp(email, inApp);
  if (push) await sendWebPushToUser(email, push);
}

// —— Trial convenience notifications ————————————————————————————
export async function notifyTrialT3(email: string, trialEndIso: string) {
  const url = `${NEXT_BASE}/paywall`;
  await notifyInAppAndPush(
    email,
    {
      title: "Trial ends in 3 days",
      message: `Your BXKR trial ends on ${fmtDate(trialEndIso)}. Subscribe to keep Premium.`,
      href: url,
      source_key: "trial",
      source_event: "t_minus_3",
    },
    { title: "Trial ends in 3 days", body: "Tap to subscribe and keep Premium.", url }
  );
}

export async function notifyTrialT1(email: string, trialEndIso: string) {
  const url = `${NEXT_BASE}/paywall`;
  await notifyInAppAndPush(
    email,
    {
      title: "Last day of trial",
      message: `Your trial ends on ${fmtDate(trialEndIso)}. Don’t lose access—subscribe now.`,
      href: url,
      source_key: "trial",
      source_event: "t_minus_1",
    },
    { title: "Last day of your BXKR trial", body: "Tap to subscribe now.", url }
  );
}

export async function notifyTrialEnded(email: string) {
  const url = `${NEXT_BASE}/paywall`;
  await notifyInAppAndPush(
    email,
    {
      title: "Trial ended",
      message: "Your trial has ended. Subscribe to regain access to Premium features.",
      href: url,
      source_key: "trial",
      source_event: "ended",
    },
    { title: "Trial ended", body: "Tap to subscribe and unlock Premium again.", url }
  );
}

// —— Weekly convenience notification ————————————————————————
export async function notifyWeeklyNudge(email: string, variant: "locked" | "active") {
  if (variant === "locked") {
    const url = `${NEXT_BASE}/paywall`;
    await notifyInAppAndPush(
      email,
      {
        title: "Weekly nudge",
        message: "You’re currently not on Premium. Subscribe to unlock all features.",
        href: url,
        source_key: "weekly",
        source_event: "locked_nudge",
      },
      { title: "BXKR Weekly", body: "Tap to subscribe and unlock Premium.", url }
    );
    return;
  }
  await notifyInAppAndPush(
    email,
    {
      title: "New week, new energy",
      message: "Track workouts, log meals, and hit your weekly goals.",
      href: NEXT_BASE || "/",
      source_key: "weekly",
      source_event: "active_nudge",
    },
    { title: "BXKR Weekly", body: "Tap to open BXKR and start strong.", url: NEXT_BASE || "/" }
  );
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
  } catch { return iso; }
}
