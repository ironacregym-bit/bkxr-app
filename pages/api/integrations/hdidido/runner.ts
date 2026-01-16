
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
      body: JSON.stringify({ to_email: email, title, body, ttl_seconds: 3600 })
    });
  } catch {
    // ignore notify errors
  }
}

/** Try to accept cookies when present (soft-fail, best-effort) */
async function acceptCookies(page: import("playwright-core").Page) {
  const selectors = [
    'button:has-text("Accept All")',
    'button:has-text("Accept all")',
    'text=Accept All',
    '[id*="accept"]',
    '[aria-label*="accept"]'
  ];
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) { await el.click({ timeout: 1500 }).catch(() => {}); return; }
    } catch { /* ignore */ }
  }
}

/** Perform HowDidiDo login with robust multi-selector strategy */
async function loginHowDidiDo(
  page: import("playwright-core").Page,
  username: string,
  password: string,
  loginUrl = HOWDIDIDO_LOGIN_URL
) {
  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await acceptCookies(page);

  // Fill email/username
  const emailSelectors = [
    'input[type="email"]',
    'input[name="Email"]',
    'input[id="Email"]',
    'input[name="email"]',
    'input[id*="email"]'
  ];
  let filledEmail = false;
  for (const sel of emailSelectors) {
    const el = await page.$(sel);
    if (el) { await el.fill(username); filledEmail = true; break; }
  }
  if (!filledEmail) throw new Error("Email/username input not found on HowDidiDo login page");

  // Fill password
  const passSelectors = [
    'input[type="password"]',
    'input[name="Password"]',
    'input[id="Password"]',
    'input[id*="password"]'
  ];
  let filledPass = false;
  for (const sel of passSelectors) {
    const el = await page.$(sel);
    if (el) { await el.fill(password); filledPass = true; break; }
  }
  if (!filledPass) throw new Error("Password input not found on HowDidiDo login page");

  // Submit
  const submitSelectors = [
    'button[type="submit"]',
    'button:has-text("Sign In")',
    'button:has-text("Log in")',
    'input[type="submit"]'
  ];
  let clicked = false;
  for (const sel of submitSelectors) {
    const el = await page.$(sel);
    if (el) { await el.click(); clicked = true; break; }
  }
  if (!clicked) throw new Error("Login submit button not found");

  // Wait for post-login; give network a chance to settle
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});

  // Success cues (tolerant)
  const successCues = [
    'text=Sign out',
    'text=My Account',
    'a[href*="/account"]',
    'a[href*="/dashboard"]'
  ];
  for (const cue of successCues) {
    const ok = await page.$(cue);
    if (ok) return; // success
  }

  // Check for an obvious error banner
  const err = await page.$('text=/invalid|error|try again/i');
  if (err) throw new Error("Login failed: invalid credentials or site error");

  // If no cues but no errors, we still accept as success (some sites keep same URL after auth)
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
      // ---- Step 0: Optional credentials ----
      // booking request docs may include enc_credentials_b64 produced by your /lib/crypto helpers
      let creds: { username?: string; password?: string } | undefined;
      if (reqData.enc_credentials_b64) {
        try { creds = decryptJson(reqData.enc_credentials_b64); } catch { /* ignore */ }
      }
      const username = creds?.username || process.env.HDIDIDO_EMAIL || "";
      const password = creds?.password || process.env.HDIDIDO_PASSWORD || "";

      if (!username || !password) {
        throw new Error("No HowDidiDo credentials provided (enc_credentials_b64 or env HDIDIDO_EMAIL/HDIDIDO_PASSWORD required)");
      }

      // ---- Step 1: Launch Playwright with @sparticuz/chromium (serverless) ----
      const { default: chromium } = await import("@sparticuz/chromium");
      const playwright = await import("playwright-core");

      const browser = await playwright.chromium.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true
      });

      const ctx = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      });
      const page = await ctx.newPage();

      // ---- Step 2: REAL LOGIN ----
      await loginHowDidiDo(page, username, password, HOWDIDIDO_LOGIN_URL);

      // If we get here without throwing, consider login successful
      confirmation_text = `Login OK as ${username.replace(/(.{2}).+(@.*)/, "$1***$2")}`;

      // (Optional) Go to a known post-login page to confirm (commented for speed)
      // await page.goto("https://www.howdidido.com/", { waitUntil: "domcontentloaded" });

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
      await notify(
        who,
        "HowDidiDo login ✅",
        confirmation_text || "Logged in successfully."
      );
    } else {
      await notify(
        who,
        "HowDidiDo login failed ❌",
        errorMsg || "Unknown error"
      );
    }

    return res.status(200).json({ ok: true, outcome, error: errorMsg || null, note: confirmation_text || null });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
