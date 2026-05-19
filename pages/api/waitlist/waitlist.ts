// File: pages/api/waitlist/waitlist.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../lib/firestoreClient";

type WaitlistBody = {
  name?: string;
  email?: string;
  phone?: string;
  goal?: string;
  consent?: boolean;
  utm?: Record<string, string | undefined>;
  referrer?: string;
};

type WaitlistResp =
  | { ok: true; existed: boolean }
  | { ok: false; error: string; detail?: string };

function normEmail(v: any): string {
  return String(v || "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  // pragmatic email check (good enough for waitlists)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function safeStr(v: any, max = 120) {
  const s = String(v || "").trim();
  return s.length > max ? s.slice(0, max) : s;
}

function getClientIp(req: NextApiRequest) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  if (Array.isArray(xf) && xf.length) return String(xf[0]).trim();
  const ra = (req.socket as any)?.remoteAddress;
  return ra ? String(ra) : "unknown";
}

// Lightweight in-memory rate limit per warm instance (good enough to stop spam)
type RL = { at: number; count: number };
const RL_MAP: Map<string, RL> = (globalThis as any).__WAITLIST_RL__ || new Map();
(globalThis as any).__WAITLIST_RL__ = RL_MAP;

function rateLimitKey(ip: string) {
  return `ip:${ip}`;
}

function isRateLimited(ip: string) {
  const key = rateLimitKey(ip);
  const now = Date.now();
  const windowMs = 10 * 60_000; // 10 minutes
  const max = 20; // 20 requests / 10 minutes / instance
  const cur = RL_MAP.get(key);

  if (!cur || now - cur.at > windowMs) {
    RL_MAP.set(key, { at: now, count: 1 });
    return false;
  }

  cur.count += 1;
  RL_MAP.set(key, cur);
  return cur.count > max;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<WaitlistResp>) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return res.status(429).json({ ok: false, error: "RATE_LIMITED" });
  }

  const body = (req.body || {}) as WaitlistBody;

  const email = normEmail(body.email);
  const name = safeStr(body.name, 80);
  const phone = safeStr(body.phone, 40);
  const goal = safeStr(body.goal, 60);
  const consent = Boolean(body.consent);

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: "INVALID_EMAIL" });
  }

  const utm = body.utm && typeof body.utm === "object" ? body.utm : {};
  const referrer = safeStr(body.referrer, 300);
  const userAgent = safeStr(req.headers["user-agent"], 200);

  const nowIso = new Date().toISOString();
  const docRef = firestore.collection("waitlist_signups").doc(email);

  try {
    const snap = await docRef.get();

    if (!snap.exists) {
      await docRef.set({
        email,
        name,
        phone: phone || null,
        goal: goal || null,
        consent,
        created_at: nowIso,
        last_submitted_at: nowIso,
        source: {
          referrer: referrer || null,
          utm: {
            utm_source: safeStr(utm.utm_source, 80) || null,
            utm_medium: safeStr(utm.utm_medium, 80) || null,
            utm_campaign: safeStr(utm.utm_campaign, 120) || null,
            utm_content: safeStr(utm.utm_content, 120) || null,
            utm_term: safeStr(utm.utm_term, 120) || null,
          },
        },
        meta: {
          user_agent: userAgent || null,
        },
      });

      return res.status(200).json({ ok: true, existed: false });
    }

    await docRef.set(
      {
        name: name || snap.data()?.name || "",
        phone: phone || snap.data()?.phone || null,
        goal: goal || snap.data()?.goal || null,
        consent: consent || snap.data()?.consent || false,
        last_submitted_at: nowIso,
        source: {
          referrer: referrer || snap.data()?.source?.referrer || null,
          utm: {
            utm_source: safeStr(utm.utm_source, 80) || snap.data()?.source?.utm?.utm_source || null,
            utm_medium: safeStr(utm.utm_medium, 80) || snap.data()?.source?.utm?.utm_medium || null,
            utm_campaign: safeStr(utm.utm_campaign, 120) || snap.data()?.source?.utm?.utm_campaign || null,
            utm_content: safeStr(utm.utm_content, 120) || snap.data()?.source?.utm?.utm_content || null,
            utm_term: safeStr(utm.utm_term, 120) || snap.data()?.source?.utm?.utm_term || null,
          },
        },
        meta: {
          user_agent: userAgent || snap.data()?.meta?.user_agent || null,
        },
      },
      { merge: true }
    );

    return res.status(200).json({ ok: true, existed: true });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[waitlist] failed:", e?.message || e);
    return res.status(500).json({ ok: false, error: "WAITLIST_FAILED", detail: e?.message });
  }
}
