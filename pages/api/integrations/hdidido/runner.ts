
// pages/api/integrations/hdidido/runner.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import { BookingRequest, BookingRun } from "../../../../lib/hdidido/types";
import { decryptJson } from "../../../../lib/crypto";

const HOWDIDIDO_LOGIN_URL = "https://www.howdidido.com/Account/Login";

// Minimal notifier using your existing /api/notify/emit
async function notify(email: string, title: string, body: string) {
  const base = process.env.APP_BASE_URL;
  if (!base) return;
  try {
    await fetch(`${base}/api/notify/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to_email: email,
        title,
        body,
        ttl_seconds: 3600
      })
    });
  } catch {
    // ignore notify errors
  }
}

/**
 * Runner entrypoint.
 * Security: requires Authorization: Bearer <CRON_SECRET>
 * NOTE: Keep Node.js Serverless runtime (do NOT export runtime: 'edge').
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ---- Guard: only allow authorised schedulers (GitHub Actions / proxy) ----
  const hdr = req.headers.authorization || "";
  if (hdr !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const now = new Date().toISOString();

    // Claim exactly one due job (status==queued and run_at <= now)
    const snap = await firestore
      .collection("golf_booking_requests")
      .where("status", "==", "queued")
      .where("run_at", "<=", now)
      .orderBy("run_at", "asc")
      .limit(1)
      .get();

    if (snap.empty) {
      return res.status(200).json({ ok: true, message: "No due jobs" });
    }

    const docRef = snap.docs[0].ref;
    const reqData = snap.docs[0].data() as BookingRequest;

    await docRef.update({
      status: "in_progress",
      attempts: (reqData.attempts ?? 0) + 1
    });

    const runRef = await firestore.collection("golf_booking_runs").add({
      request_id: docRef.id,
      started_at: now
    } as BookingRun);

    let outcome: "success" | "failed" = "failed";
    let errorMsg: string | undefined;
    let confirmation_text: string | undefined;

    try {
      // Optional credentials (will be used in Step 2 – login flow)
      let creds: { username?: string; password?: string } | undefined;
      if (reqData.enc_credentials_b64) {
        try {
          creds = decryptJson(reqData.enc_credentials_b64);
        } catch {
          // continue without creds if decrypt fails
        }
      }

      // Dynamic import at runtime to keep build lean
      const playwright = await import("playwright-core");

      const ws = process.env.BROWSER_WS_ENDPOINT;
      if (!ws) throw new Error("BROWSER_WS_ENDPOINT not set");

      // Prefer standard Playwright connect (works best with Browserless /playwright?token=...)
      // Fallback to connectOverCDP if provider expects CDP.
      let browser: any;
      try {
        browser = await (playwright.chromium as any).connect(ws);
      } catch (e1: any) {
        try {
          // @ts-ignore - connectOverCDP exists on chromium
          browser = await (playwright.chromium as any).connectOverCDP(ws);
        } catch (e2: any) {
          const err1 = e1?.message || String(e1);
          const err2 = e2?.message || String(e2);
          throw new Error(
            `Failed to connect to hosted browser.\nconnect(): ${err1}\nconnectOverCDP(): ${err2}`
          );
        }
      }

      const ctx = await browser.newContext();
      const page = await ctx.newPage();

      // Step 1: connectivity check only (we will implement full login+booking in Step 2)
      await page.goto(HOWDIDIDO_LOGIN_URL, {
        waitUntil: "domcontentloaded",
        timeout: 30_000
      });
      confirmation_text = `Loaded: ${await page.title()}`;

      await ctx.close();
      await browser.close();

      outcome = "success";
    } catch (err: any) {
      errorMsg = err?.message || String(err);
    }

    const finished = new Date().toISOString();
    await runRef.update({
      finished_at: finished,
      outcome,
      error: errorMsg,
      evidence: { confirmation_text }
    } as Partial<BookingRun>);

    await docRef.update({ status: outcome });

    // Notify requester (you can mute this while testing if you prefer)
    const who = reqData.requester_email;
    if (outcome === "success") {
      await notify(
        who,
        "HowDidiDo runner connected ✅",
        `Verified page load: ${confirmation_text || ""}`
      );
    } else {
      await notify(
        who,
        "HowDidiDo booking failed ❌",
        errorMsg || "Unknown error"
      );
    }

    
  const ws = process.env.BROWSER_WS_ENDPOINT || "";
  const maskedWs = ws.replace(/(token=)[^&]+/i, "$1***");
  const hasToken = /\btoken=/.test(ws);
  return res.status(200).json({ ok: true, outcome, error: errorMsg || null, maskedWs, hasToken });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
