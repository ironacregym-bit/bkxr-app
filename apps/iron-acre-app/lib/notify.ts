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

type WebPushSubscriptionLike = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  last_seen?: any;
  [key: string]: any;
};

const USE_NOTIFY_API = process.env.USE_NOTIFY_API === "1";
const NEXT_BASE = process.env.NEXTAUTH_URL || "";

function normaliseEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function makePayloadString(push: PushPayload) {
  return JSON.stringify({
    title: push.title,
    body: push.body,
    url: push.url,
    icon: push.icon || "/icons/icon-192.png",
    badge: push.badge || "/icons/badge-72.png",
  });
}

function isValidSubscriptionShape(sub: any): sub is WebPushSubscriptionLike {
  return Boolean(
    sub &&
      typeof sub === "object" &&
      typeof sub.endpoint === "string" &&
      sub.endpoint.trim() &&
      sub.keys &&
      typeof sub.keys === "object" &&
      typeof sub.keys.p256dh === "string" &&
      sub.keys.p256dh.trim() &&
      typeof sub.keys.auth === "string" &&
      sub.keys.auth.trim()
  );
}

function dedupeSubscriptions(subs: any[]): WebPushSubscriptionLike[] {
  const seen = new Set<string>();
  const out: WebPushSubscriptionLike[] = [];

  for (const raw of subs) {
    if (!isValidSubscriptionShape(raw)) continue;

    const endpoint = String(raw.endpoint).trim();
    if (!endpoint || seen.has(endpoint)) continue;

    seen.add(endpoint);

    out.push({
      endpoint,
      expirationTime:
        typeof raw.expirationTime === "number" || raw.expirationTime === null
          ? raw.expirationTime ?? null
          : null,
      keys: {
        p256dh: String(raw.keys?.p256dh || ""),
        auth: String(raw.keys?.auth || ""),
      },
      last_seen: raw.last_seen ?? null,
    });
  }

  return out;
}

// —— Option A: direct Firestore write (default) ————————————————
async function pushInAppDirect(email: string, payload: InAppPayload) {
  const safeEmail = normaliseEmail(email);
  const nowIso = new Date().toISOString();
  const ref = firestore.collection("user_notifications").doc(safeEmail).collection("items");

  await ref.add({
    ...payload,
    created_at: nowIso,
    read_at: null,
    delivered_channels: ["in_app", "push"],
  });
}

// —— Option B: call your existing notify API (plug-in) ——————————
async function pushInAppViaApi(email: string, payload: InAppPayload) {
  const safeEmail = normaliseEmail(email);

  if (!NEXT_BASE) {
    return pushInAppDirect(safeEmail, payload);
  }

  await fetch(`${NEXT_BASE}/api/notify/emit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": process.env.CRON_KEY || "",
    },
    body: JSON.stringify({ email: safeEmail, ...payload }),
  }).catch(() => null);
}

async function pushInApp(email: string, payload: InAppPayload) {
  const safeEmail = normaliseEmail(email);
  return USE_NOTIFY_API ? pushInAppViaApi(safeEmail, payload) : pushInAppDirect(safeEmail, payload);
}

async function sendWebPushToUser(email: string, push: PushPayload) {
  const safeEmail = normaliseEmail(email);
  if (!safeEmail) return;

  const docRef = firestore.collection("web_push_subscriptions").doc(safeEmail);
  const doc = await docRef.get();

  const rawSubs: any[] =
    doc.exists && Array.isArray(doc.data()?.subs) ? (doc.data()!.subs as any[]) : [];

  const uniqueSubs = dedupeSubscriptions(rawSubs);

  if (!uniqueSubs.length) {
    // If the stored list only contains junk/duplicates, clean it up.
    if (doc.exists && rawSubs.length > 0) {
      await docRef.set(
        { email: safeEmail, subs: [], updated_at: new Date() },
        { merge: true }
      );
    }
    return;
  }

  const payload = makePayloadString(push);
  const keep: WebPushSubscriptionLike[] = [];

  for (const sub of uniqueSubs) {
    try {
      await webpush.sendNotification(sub as any, payload);
      keep.push(sub);
    } catch (err: any) {
      const status = Number(err?.statusCode || 0);

      // prune invalid subscriptions
      if (status !== 404 && status !== 410) {
        keep.push(sub);
      }
    }
  }

  const shouldWriteBack =
    rawSubs.length !== keep.length ||
    rawSubs.length !== uniqueSubs.length;

  if (shouldWriteBack) {
    await docRef.set(
      {
        email: safeEmail,
        subs: keep,
        updated_at: new Date(),
      },
      { merge: true }
    );
  }
}

export async function notifyInAppAndPush(
  email: string,
  inApp: InAppPayload,
  push?: PushPayload
) {
  const safeEmail = normaliseEmail(email);
  if (!safeEmail) return;

  await pushInApp(safeEmail, inApp);

  if (push) {
    await sendWebPushToUser(safeEmail, push);
  }
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
    {
      title: "Trial ends in 3 days",
      body: "Tap to subscribe and keep Premium.",
      url,
    }
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
    {
      title: "Last day of your BXKR trial",
      body: "Tap to subscribe now.",
      url,
    }
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
    {
      title: "Trial ended",
      body: "Tap to subscribe and unlock Premium again.",
      url,
    }
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
      {
        title: "BXKR Weekly",
        body: "Tap to subscribe and unlock Premium.",
        url,
      }
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
    {
      title: "BXKR Weekly",
      body: "Tap to open BXKR and start strong.",
      url: NEXT_BASE || "/",
    }
  );
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
