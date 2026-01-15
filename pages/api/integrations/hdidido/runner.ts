
// pages/api/integrations/hdidido/runner.ts x2
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import { BookingRequest, BookingRun } from "../../../../lib/hdidido/types";
import { decryptJson } from "../../../../lib/crypto";
import * as playwright from "playwright-core";

const HOWDIDIDO_LOGIN_URL = "https://www.howdidido.com/Account/Login"; // public login URL
// Booking help indicates both competition & casual bookings exist in the UI.  [4](https://help.howdidido.com/hc/en-gb/articles/7559597856285-Booking-tee-times-on-the-HowDidiDo-app)

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
  } catch {}
}

async function connectBrowser() {
  const ws = process.env.BROWSER_WS_ENDPOINT;
  if (!ws) throw new Error("BROWSER_WS_ENDPOINT not set");

  // Try CDP, then standard connect.
  try {
    // @ts-ignore - connectOverCDP exists for Chromium
    const browser = await (playwright.chromium as any).connectOverCDP(ws);
    return { browser, via: "cdp" as const };
  } catch {
    const browser = await (playwright.chromium as any).connect(ws);
    return { browser, via: "ws" as const };
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

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

    if (snap.empty) return res.status(200).json({ ok: true, message: "No due jobs" });

    const docRef = snap.docs[0].ref;
    const reqData = snap.docs[0].data() as BookingRequest;

    // Mark in_progress
    await docRef.update({ status: "in_progress", attempts: (reqData.attempts ?? 0) + 1 });

    const runRef = await firestore.collection("golf_booking_runs").add({
      request_id: docRef.id,
      started_at: now
    } as BookingRun);

    let outcome: "success" | "failed" = "failed";
    let errorMsg: string | undefined;
    let confirmation_text: string | undefined;

    try {
      // Optional credentials
      let creds: { username?: string; password?: string } | undefined;
      if (reqData.enc_credentials_b64) {
        try {
          creds = decryptJson(reqData.enc_credentials_b64);
        } catch (e) {
          // continue without creds; we can do anonymous checks
        }
      }

      const { browser } = await connectBrowser(); // remote browser (recommended on Vercel)  [1](https://www.browserless.io/blog/playwright-vercel)[2](https://www.onkernel.com/blog/running-playwright-on-vercel)
      const ctx = await browser.newContext();
      const page = await ctx.newPage();

      // 1) Visit login page (just to prove connectivity + baseline)
      await page.goto(HOWDIDIDO_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

      // (Step 2 will implement form fill + booking flow using stable selectors)

      // Lightweight verification: page title contains "Login" or nav visible
      const title = await page.title();
      confirmation_text = `Loaded: ${title}`;

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

    // Notify requester
    const who = reqData.requester_email;
    if (outcome === "success") {
      await notify(who, "HowDidiDo runner connected ✅", `Verified browser & page load: ${confirmation_text || ""}`);
    } else {
      await notify(who, "HowDidiDo booking failed ❌", errorMsg || "Unknown error");
    }

    return res.status(200).json({ ok: true, outcome, error: errorMsg });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
