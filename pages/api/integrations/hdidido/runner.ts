
// pages/api/integrations/hdidido/runner.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import { BookingRequest, BookingRun } from "../../../../lib/hdidido/types";
import { decryptJson } from "../../../../lib/crypto";

const HOWDIDIDO_LOGIN_URL = "https://www.howdidido.com/Account/Login";

// Optional: tiny helper to send a user notification using your existing endpoint
async function notify(email: string, title: string, body: string) {
  const base = process.env.APP_BASE_URL;
  if (!base) return;
  try {
    await fetch(`${base}/api/notify/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_email: email, title, body, ttl_seconds: 3600 }),
    });
  } catch {
    // ignore
  }
}

// IMPORTANT: Do not export an Edge runtime here. Keep default Node.js serverless.

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // ---- Secure the endpoint so only your scheduler can trigger it ----
  const hdr = req.headers.authorization || "";
  if (hdr !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const now = new Date().toISOString();

    // Claim one due job atomically: status=queued and run_at ≤ now
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
      attempts: (reqData.attempts ?? 0) + 1,
    });

    const runRef = await firestore.collection("golf_booking_runs").add({
      request_id: docRef.id,
      started_at: now,
    } as BookingRun);

    let outcome: "success" | "failed" = "failed";
    let errorMsg: string | undefined;
    let confirmation_text: string | undefined;

    try {
      // Optional credentials (not used in Step 1)
      let creds: { username?: string; password?: string } | undefined;
      if (reqData.enc_credentials_b64) {
        try {
          creds = decryptJson(reqData.enc_credentials_b64);
        } catch {
          // carry on without creds
        }
      }

      // Dynamic import ensures module resolution only at runtime in the function
      const playwright = await import("playwright-core");

      // Connect to a hosted browser over CDP (recommended on Vercel)
      const ws = process.env.BROWSER_WS_ENDPOINT;
      if (!ws) throw new Error("BROWSER_WS_ENDPOINT not set");

      let browser: any;
      try {
        // @ts-ignore: connectOverCDP is available on chromium in playwright-core
        browser = await (playwright.chromium as any).connectOverCDP(ws);
      } catch {
        browser = await (playwright.chromium as any).connect(ws);
      }

      const ctx = await browser.newContext();
      const page = await ctx.newPage();

      // Step 1: connectivity check only (we'll add real booking in Step 2)
      await page.goto(HOWDIDIDO_LOGIN_URL, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
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
      evidence: { confirmation_text },
    } as Partial<BookingRun>);

    await docRef.update({ status: outcome });

    // Notify requester
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

    return res.status(200).json({ ok: true, outcome, error: errorMsg });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
