
// pages/api/integrations/hdidido/runner.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import { BookingRequest, BookingRun } from "../../../../lib/hdidido/types";
import { decryptJson } from "../../../../lib/crypto";

const HOWDIDIDO_LOGIN_URL = "https://www.howdidido.com/Account/Login";

// --- Minimal notifier using your existing /api/notify/emit
async function notify(email: string, title: string, body: string) {
  const base = process.env.APP_BASE_URL;
  if (!base) return;
  try {
    await fetch(`${base}/api/notify/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_email: email, title, body, ttl_seconds: 3600 })
    });
  } catch { /* ignore notify errors */ }
}

// --- Consent (now includes explicit OK)
async function acceptCookies(page: import("playwright-core").Page) {
  const selectors = [
    'button:has-text("OK")',
    'a:has-text("OK")',
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
        await page.waitForTimeout(300);
        break;
      }
    } catch {}
  }
}

// --- “Use the app / upgrade” gate: click obvious actions + remove overlays
async function smashUpgradeGate(page: import("playwright-core").Page) {
  const buttonTexts = [
    "Use web version",
    "Continue in browser",
    "Continue to site",
    "Continue",
    "Open web",
    "Skip",
    "Not now",
    "Later",
    "Close",
    "Dismiss",
    "X"
  ];
  for (const txt of buttonTexts) {
    try {
      const btn =
        (await page.$(`button:has-text("${txt}")`)) ||
        (await page.$(`a:has-text("${txt}")`));
      if (btn) {
        await btn.click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
    } catch {}
  }

  // Kill high‑z overlays, especially those that look like app banners/modals
  try {
    await page.evaluate(() => {
      const kill = (el: Element) => el.parentNode?.removeChild(el);
      const looksLikeUpgrade = (s: string) => /upgrade|update|install|app|smartbanner/i.test(s);
      const all = Array.from(document.querySelectorAll<HTMLElement>("*"));
      for (const el of all) {
        const s = window.getComputedStyle(el);
        const idc = `${el.id || ""} ${el.className?.toString() || ""}`;
        const z = parseInt(s.zIndex || "0", 10);
        const dialogish =
          el.getAttribute("role") === "dialog" ||
          /modal/i.test(el.className?.toString() || "");
        const fixedish =
          s.position === "fixed" || s.position === "sticky" || dialogish;
        if (fixedish && (z >= 100 || looksLikeUpgrade(idc))) {
          try { kill(el); } catch {}
        }
      }
      document.documentElement.style.overflow = "auto";
      document.body.style.overflow = "auto";
      document.body.style.pointerEvents = "auto";
    });
  } catch {}
  await page.waitForTimeout(200);
}

// --- Gentle modal dismissal (bootstrap, escape, etc.)
async function dismissUpgradeModal(page: import("playwright-core").Page) {
  const selectors = [
    'button:has-text("Later")',
    'button:has-text("Not now")',
    'button:has-text("Continue")',
    'button:has-text("Close")',
    'button:has-text("Dismiss")',
    'a:has-text("Close")',
    'a:has-text("Dismiss")',
    'button[aria-label*="close" i]',
    'button[title*="close" i]',
    '.modal-header .btn-close',
    '.modal .btn-close',
    '.modal [data-bs-dismiss="modal"]',
    '.modal .close',
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
      await page.waitForTimeout(250);
    } catch {}
  }
  try { await page.keyboard.press("Escape"); } catch {}
  await page.waitForTimeout(150);
}

// --- “Nuke overlays” (fallback): remove any high‑z fixed/sticky elements
async function nukeOverlays(page: import("playwright-core").Page) {
  try {
    await page.evaluate(() => {
      const kill = (el: Element) => el.parentNode?.removeChild(el);
      const all = Array.from(document.querySelectorAll<HTMLElement>("*"));
      for (const el of all) {
        const s = window.getComputedStyle(el);
        const z = parseInt(s.zIndex || "0", 10);
        const dialog =
          el.getAttribute("role") === "dialog" ||
          (el.className?.toString() || "").toLowerCase().includes("modal");
        if ((s.position === "fixed" || s.position === "sticky" || dialog) && z >= 100) {
          try { kill(el); } catch {}
        }
      }
      document.body.style.overflow = "auto";
    });
  } catch {}
  await page.waitForTimeout(200);
}

// --- Diagnostics: list frames
function listFrameUrls(page: import("playwright-core").Page) {
  return page.frames().map(f => ({ name: f.name(), url: f.url() }));
}

// --- Find/click/fill across frames
async function findInFrames(page: import("playwright-core").Page, selectors: string[]) {
  for (const frame of page.frames()) {
    for (const sel of selectors) {
      try {
        const handle = await frame.$(sel);
        if (handle) return { frame, handle, selector: sel };
      } catch {}
    }
  }
  return null;
}
async function clickInFrames(page: import("playwright-core").Page, selectors: string[]) {
  const found = await findInFrames(page, selectors);
  if (!found) return false;
  try { await found.handle.click(); return true; } catch { return false; }
}
async function fillInFrames(page: import("playwright-core").Page, selectors: string[], value: string) {
  const found = await findInFrames(page, selectors);
  if (!found) return false;
  try { await found.handle.fill(value); return true; } catch { return false; }
}

// --- Evidence
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
  const frames = listFrameUrls(page);
  return { url, title, htmlSnippet, screenshot_b64, frames };
}

/** Try the exact native selectors seen on the page screenshot */
async function tryNativeDirect(page: import("playwright-core").Page, username: string, password: string) {
  // Target the obvious IDs/labels first
  const emailCandidates = ['#Email', 'input[name="Email"]', 'input[type="email"]', 'input[name="email"]', 'input[id*="email"]', 'input[type="text"]'];
  const passCandidates  = ['#Password', 'input[name="Password"]', 'input[type="password"]', 'input[id*="password"]', 'input[name="password"]'];

  let emailEl = null;
  for (const sel of emailCandidates) { emailEl = await page.$(sel); if (emailEl) break; }
  if (!emailEl) return false;

  let passEl = null;
  for (const sel of passCandidates) { passEl = await page.$(sel); if (passEl) break; }
  if (!passEl) return false;

  await emailEl.fill(username);
  await passEl.fill(password);

  // Button might be <button> or <a>, so match both
  const loginButton =
    (await page.$('button:has-text("Log in")')) ||
    (await page.$('a:has-text("Log in")')) ||
    (await page.$('button[type="submit"]')) ||
    (await page.$('input[type="submit"]'));
  if (!loginButton) throw new Error('Login submit not found (native direct)');

  await loginButton.click({ timeout: 2000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});

  // Success cues on same/main frame
  const ok =
    (await page.$('text=Sign out')) ||
    (await page.$('text=My Account')) ||
    (await page.$('a[href*="/account"]')) ||
    (await page.$('a[href*="/dashboard"]'));
  return !!ok;
}

// --- Native login (frame‑aware fallback)
async function tryNativeLogin(page: import("playwright-core").Page, username: string, password: string) {
  await page.waitForTimeout(600);
  await dismissUpgradeModal(page);
  await smashUpgradeGate(page);

  const emailFilled = await fillInFrames(page, [
    'input[type="email"]', 'input[name="Email"]', 'input[id="Email"]',
    'input[name="email"]', 'input[id*="email"]', 'input[type="text"]'
  ], username);
  if (!emailFilled) return false;

  const passFilled = await fillInFrames(page, [
    '#Password',
    'input[type="password"]', 'input[name="Password"]', 'input[id="Password"]',
    'input[id*="password"]', 'input[name="password"]'
  ], password);
  if (!passFilled) return false;

  const clicked = await clickInFrames(page, [
    'button:has-text("Log in")',
    'a:has-text("Log in")',
    'button[type="submit"]',
    'input[type="submit"]'
  ]);
  if (!clicked) throw new Error("Login submit button not found (native form)");

  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await dismissUpgradeModal(page);
  await smashUpgradeGate(page);
  await nukeOverlays(page);

  const successCues = [
    'text=Sign out', 'text=My Account',
    'a[href*="/account"]', 'a[href*="/dashboard"]'
  ];
  const ok = await findInFrames(page, successCues);
  return !!ok;
}

// --- Azure AD / Microsoft login (works if main navigates or if inside a frame)
async function tryMicrosoftLogin(page: import("playwright-core").Page, username: string, password: string) {
  await page.waitForTimeout(600);
  await dismissUpgradeModal(page);
  await smashUpgradeGate(page);
  await nukeOverlays(page);

  // Case A: site redirected main page to Microsoft
  const onAzureMain = /login\.microsoftonline\.com/i.test(page.url());
  if (onAzureMain) {
    const emailInputMain =
      (await page.$('#i0116')) ||
      (await page.$('input[name="loginfmt"]')) ||
      (await page.$('input[type="email"]'));
    if (!emailInputMain) return false;
    await emailInputMain.fill(username);

    const nextBtnMain = (await page.$('#idSIButton9')) || (await page.$('input[type="submit"]'));
    if (!nextBtnMain) throw new Error("Microsoft login: Next button not found");
    await nextBtnMain.click();

    await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
    await dismissUpgradeModal(page);
    await smashUpgradeGate(page);
    await nukeOverlays(page);

    const passInputMain =
      (await page.$('#i0118')) ||
      (await page.$('input[name="passwd"]')) ||
      (await page.$('input[type="password"]'));
    if (!passInputMain) throw new Error("Microsoft login: password input not found");
    await passInputMain.fill(password);

    const signInBtnMain = (await page.$('#idSIButton9')) || (await page.$('input[type="submit"]'));
    if (!signInBtnMain) throw new Error("Microsoft login: Sign in button not found");
    await signInBtnMain.click();

    await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
    await dismissUpgradeModal(page);
    await smashUpgradeGate(page);
    await nukeOverlays(page);

    // Stay signed in?
    const stayNoMain = await page.$('#idBtn_Back');
    if (stayNoMain) await stayNoMain.click().catch(() => {});
    else {
      const stayYesMain = await page.$('#idSIButton9');
      if (stayYesMain) await stayYesMain.click().catch(() => {});
    }

    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await dismissUpgradeModal(page);
    await smashUpgradeGate(page);
    await nukeOverlays(page);

    const okMain =
      (await page.$('text=Sign out')) ||
      (await page.$('text=My Account')) ||
      (await page.$('a[href*="/account"]')) ||
      (await page.$('a[href*="/dashboard"]'));
    return !!okMain;
  }

  // Case B: Microsoft is inside an iframe
  const emailOk = await fillInFrames(page, ['#i0116', 'input[name="loginfmt"]', 'input[type="email"]'], username);
  if (!emailOk) return false;

  const nextOk = await clickInFrames(page, ['#idSIButton9', 'input[type="submit"]', 'button:has-text("Next")']);
  if (!nextOk) throw new Error("Microsoft login: Next button not found");

  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  await dismissUpgradeModal(page);
  await smashUpgradeGate(page);
  await nukeOverlays(page);

  const passOk = await fillInFrames(page, ['#i0118', 'input[name="passwd"]', 'input[type="password"]'], password);
  if (!passOk) throw new Error("Microsoft login: password input not found");

  const signOk = await clickInFrames(page, ['#idSIButton9', 'input[type="submit"]', 'button:has-text("Sign in")']);
  if (!signOk) throw new Error("Microsoft login: Sign in button not found");

  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  await dismissUpgradeModal(page);
  await smashUpgradeGate(page);
  await nukeOverlays(page);

  const stayNo = await clickInFrames(page, ['#idBtn_Back', 'button:has-text("No")']);
  if (!stayNo) {
    await clickInFrames(page, ['#idSIButton9', 'button:has-text("Yes")']).catch(() => {});
  }

  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await dismissUpgradeModal(page);
  await smashUpgradeGate(page);
  await nukeOverlays(page);

  const successCues = [
    'text=Sign out', 'text=My Account',
    'a[href*="/account"]', 'a[href*="/dashboard"]'
  ];
  const ok = await findInFrames(page, successCues);
  return !!ok;
}

/**
 * Runner entrypoint.
 * Security: requires Authorization: Bearer <CRON_SECRET>
 * NOTE: Keep Node.js Serverless runtime (do NOT export runtime: 'edge').
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const hdr = req.headers.authorization || "";
  if (hdr !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const now = new Date().toISOString();

    // Claim exactly one due job
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
      // Credentials: per‑job (encrypted) > env fallback
      let creds: { username?: string; password?: string } | undefined;
      if (reqData.enc_credentials_b64) {
        try { creds = decryptJson(reqData.enc_credentials_b64); } catch {}
      }
      const username = creds?.username || process.env.HDIDIDO_EMAIL || "";
      const password = creds?.password || process.env.HDIDIDO_PASSWORD || "";
      if (!username || !password) {
        throw new Error("No HowDidiDo credentials (enc_credentials_b64 or env HDIDIDO_EMAIL/HDIDIDO_PASSWORD)");
      }

      // Launch serverless Chromium
      const { default: chromium } = await import("@sparticuz/chromium");
      const playwright = await import("playwright-core");
      const browser = await playwright.chromium.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true
      });
      const ctx = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      });
      const page = await ctx.newPage();

      // Go to login + clear blockers
      await page.goto(HOWDIDIDO_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
      await acceptCookies(page);        // now clicks the green "OK"
      await dismissUpgradeModal(page);
      await smashUpgradeGate(page);
      await nukeOverlays(page);

      // 1) Try the exact native selectors first (as in your screenshot)
      let loggedIn = false;
      try {
        loggedIn = await tryNativeDirect(page, username, password);
      } catch { /* ignore and fall through */ }

      // 2) Fallback: broader native (frame‑aware) if direct failed
      if (!loggedIn) {
        await dismissUpgradeModal(page);
        await smashUpgradeGate(page);
        await nukeOverlays(page);
        try {
          loggedIn = await tryNativeLogin(page, username, password);
        } catch { /* ignore */ }
      }

      // 3) Fallback: Microsoft/Azure AD flow if needed
      if (!loggedIn) {
        await dismissUpgradeModal(page);
        await smashUpgradeGate(page);
        await nukeOverlays(page);
        loggedIn = await tryMicrosoftLogin(page, username, password);
      }

      if (!loggedIn) {
        evidence = await collectEvidence(page);
        throw new Error("Could not detect a successful login (modal/IdP variant blocked inputs).");
      }

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

    // Notify requester
    const who = reqData.requester_email;
    if (who) {
      if (outcome === "success") {
        await notify(who, "HowDidiDo login ✅", confirmation_text || "Logged in successfully.");
      } else {
        await notify(who, "HowDidiDo login failed ❌", errorMsg || "Unknown error");
      }
    }

    return res.status(200).json({ ok: true, outcome, error: errorMsg || null, note: confirmation_text || null });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
