
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
  } catch { /* ignore */ }
}

/** Try to accept cookies when present (soft-fail, best-effort) */
async function acceptCookies(page: import("playwright-core").Page) {
  const selectors = [
    'button:has-text("Accept")',
    'button:has-text("Accept All")',
    'button:has-text("Agree")',
    '#onetrust-accept-btn-handler',
    '[id*="accept"]',
    '[aria-label*="accept"]'
  ];
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click({ timeout: 1500 }).catch(() => {});
        // brief pause to allow DOM to update
        await page.waitForTimeout(300);
        break;
      }
    } catch { /* ignore */ }
  }
}

/** Dismiss the app-upgrade/version modal or any blocking overlay, best-effort */
async function dismissUpgradeModal(page: import("playwright-core").Page) {
  const selectors = [
    // probable modal actions
    'button:has-text("Later")',
    'button:has-text("Not now")',
    'button:has-text("Continue")',
    'button:has-text("Close")',
    'button:has-text("Dismiss")',
    'a:has-text("Close")',
    'a:has-text("Dismiss")',

    // close icons / bootstrap dismissors
    'button[aria-label*="close" i]',
    'button[title*="close" i]',
    '.modal-header .btn-close',
    '.modal .btn-close',
    '.modal [data-bs-dismiss="modal"]',
    '.modal .close',

    // backdrop (last resort)
    '.modal-backdrop'
  ];

  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (!el) continue;

      if (sel === '.modal-backdrop') {
        await page.click('.modal-backdrop', { position: { x: 10, y: 10 }, timeout: 800 }).catch(() => {});
      } else {
        await el.click({ timeout: 800 }).catch(() => {});
      }
      await page.waitForTimeout(350);
    } catch { /* ignore */ }
  }

  // Some modals respond to Escape
  try { await page.keyboard.press("Escape"); } catch {}
  await page.waitForTimeout(150);
}

/** Collect debug evidence (title, url, html snippet, screenshot) */
async function collectEvidence(page: import("playwright-core").Page) {
  const url = page.url();
  const title = await page.title().catch(() => "");
  let htmlSnippet: string | undefined;
  try {
    const html = await page.content();
    htmlSnippet = html.slice(0, 8192);
  } catch {}
  let screenshot_b64: string | undefined;
  try {
    const buf = await page.screenshot({ type: "jpeg", quality: 60, fullPage: false });
    screenshot_b64 = `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {}
  return { url, title, htmlSnippet, screenshot_b64 };
}

/** Try native HowDidiDo login (email/password on same page) */
async function tryNativeLogin(page: import("playwright-core").Page, username: string, password: string) {
  // Wait a beat for late DOM injection
  await page.waitForTimeout(600);
  await dismissUpgradeModal(page);

  const emailSel = await page.$(
    'input[type="email"], input[name="Email"], input[id="Email"], input[name="email"], input[id*="email"]'
  );
  if (!emailSel) return false; // not the native variant
  await emailSel.fill(username);

  const passSel = await page.$(
    'input[type="password"], input[name="Password"], input[id="Password"], input[id*="password"]'
  );
  if (!passSel) return false; // likely an IdP flow instead of native
  await passSel.fill(password);

  const submitSel =
    (await page.$('button[type="submit"]')) ||
    (await page.$('button:has-text("Sign In")')) ||
    (await page.$('button:has-text("Log in")')) ||
    (await page.$('input[type="submit"]'));
  if (!submitSel) throw new Error("Login submit button not found (native form)");
  await submitSel.click();

  // Give time for post-login
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await dismissUpgradeModal(page);

  // Success cues
  const successCues = [
    'text=Sign out', 'text=My Account',
    'a[href*="/account"]', 'a[href*="/dashboard"]'
  ];
  for (const cue of successCues) {
    if (await page.$(cue)) return true;
  }
  return false;
}

/** Try Microsoft / Azure AD login flow */
async function tryMicrosoftLogin(page: import("playwright-core").Page, username: string, password: string) {
  await page.waitForTimeout(600);
  await dismissUpgradeModal(page);

  // First page: email field (#i0116 or name=loginfmt), then Next (#idSIButton9)
  const emailInput =
    (await page.$('#i0116')) ||
    (await page.$('input[name="loginfmt"]')) ||
    (await page.$('input[type="email"]'));
  if (!emailInput) return false; // not an MS page
  await emailInput.fill(username);

  const nextBtn = (await page.$('#idSIButton9')) || (await page.$('input[type="submit"]'));
  if (!nextBtn) throw new Error("Microsoft login: Next button not found");
  await nextBtn.click();

  // Wait for password page
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  await dismissUpgradeModal(page);

  const passInput =
    (await page.$('#i0118')) ||
    (await page.$('input[name="passwd"]')) ||
    (await page.$('input[type="password"]'));
  if (!passInput) throw new Error("Microsoft login: password input not found");
  await passInput.fill(password);

  const signInBtn = (await page.$('#idSIButton9')) || (await page.$('input[type="submit"]'));
  if (!signInBtn) throw new Error("Microsoft login: Sign in button not found");
  await signInBtn.click();

  // “Stay signed in?” screen — choose No (or Yes)
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  await dismissUpgradeModal(page);

  const stayNo = await page.$('#idBtn_Back');
  const stayYes = await page.$('#idSIButton9');
  if (stayNo) await stayNo.click().catch(() => {});
  else if (stayYes) await stayYes.click().catch(() => {});

  // Wait to get back to HowDidiDo
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await dismissUpgradeModal(page);

  const successCues = [
    'text=Sign out', 'text=My Account',
    'a[href*="/account"]', 'a[href*="/dashboard"]'
  ];
  for (const cue of successCues) {
    if (await page.$(cue)) return true;
  }
  return false;
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
    let evidence: any = {};

    try {
      // ---- Credentials resolution ----
      let creds: { username?: string; password?: string } | undefined;
      if (reqData.enc_credentials_b64) {
        try { creds = decryptJson(reqData.enc_credentials_b64); } catch { /* ignore */ }
      }
      const username = creds?.username || process.env.HDIDIDO_EMAIL || "";
      const password = creds?.password || process.env.HDIDIDO_PASSWORD || "";

      if (!username || !password) {
        throw new Error("No HowDidiDo credentials provided (enc_credentials_b64 or env HDIDIDO_EMAIL/HDIDIDO_PASSWORD required)");
      }

      // ---- Launch Playwright with @sparticuz/chromium (serverless) ----
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

      // ---- Navigate, accept cookies, dismiss upgrade modal ----
      await page.goto(HOWDIDIDO_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await acceptCookies(page);
      await dismissUpgradeModal(page);

      // ---- Try native login; if not found, try Microsoft/Azure AD ----
      let loggedIn = false;
      try {
        await dismissUpgradeModal(page);
        loggedIn = await tryNativeLogin(page, username, password);
      } catch {
        // proceed to Microsoft if native throws
      }
      if (!loggedIn) {
        await dismissUpgradeModal(page);
        loggedIn = await tryMicrosoftLogin(page, username, password);
      }

      // Final guard: if still not logged in, collect evidence and fail
      if (!loggedIn) {
        evidence = await collectEvidence(page);
        throw new Error("Could not detect a successful login (modal/IdP variant blocked inputs).");
      }

      // Success
      confirmation_text = `Login OK as ${username.replace(/(.{2}).+(@.*)/, "$1***$2")}`;
      evidence = await collectEvidence(page);

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
      evidence: { confirmation_text, ...evidence }
    } as Partial<BookingRun>);

    await docRef.update({ status: outcome });

    // Notify requester (you can mute during testing)
    const who = reqData.requester_email;
    if (who) {
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
    }

    return res.status(200).json({ ok: true, outcome, error: errorMsg || null, note: confirmation_text || null });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
