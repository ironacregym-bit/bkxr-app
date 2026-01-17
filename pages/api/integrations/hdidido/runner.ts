
// pages/api/integrations/hdidido/runner.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";

/**
 * Login (native + MS/Azure) -> open BookingAdd (hard-coded) ->
 * If "Permission Denied", seed clubv1 session via tokened TeeSheet -> retry BookingAdd ->
 * Add self, tick terms, wait for Confirm, click it.
 * Persist run to Firestore with step screenshots (subcollection 'screens') and small HTML snippets ('html').
 *
 * ENV REQUIRED:
 *  - CRON_SECRET
 *  - HDIDIDO_PASSWORD          (password for USER_EMAIL)
 * Recommended:
 *  - HDIDIDO_TEE_TOKEN         (club token to seed session)
 */

const LOGIN_URL = "https://www.howdidido.com/Account/Login";
const USER_EMAIL = "ben.jones1974@hotmail.co.uk";

// Hard-coded smoke target: 18 Jan 2026 @ 06:00
const BOOKING_DATE = "2026-01-18";
const BOOKING_TIME = "06:00";
const COURSE_ID = 12274;
const BOOKING_ADD_URL =
  "https://howdidido-whs.clubv1.com/HDIDBooking/BookingAdd" +
  `?dateTime=${encodeURIComponent(`${BOOKING_DATE}T${BOOKING_TIME}`)}` +
  `&courseId=${COURSE_ID}` +
  "&startPoint=1" +
  "&crossOverStartPoint=0" +
  "&crossOverMinutes=0" +
  "&releasedReservation=False";

// Optional fallback token (env is preferred)
const FALLBACK_TOKEN = "OI540B8E14I714I969";

/* -------------------- Small utilities -------------------- */

async function acceptCookies(page: import("playwright-core").Page) {
  const sels = [
    'button:has-text("OK")','a:has-text("OK")',
    'button:has-text("Accept")','button:has-text("Accept All")','button:has-text("Agree")',
    '#onetrust-accept-btn-handler','[id*="accept"]','[aria-label*="accept"]',
  ];
  for (const s of sels) {
    try { const el = await page.$(s); if (el) { await el.click({ timeout: 1000 }).catch(() => {}); await page.waitForTimeout(200); break; } } catch {}
  }
}

async function dismissUpgradeModal(page: import("playwright-core").Page) {
  const sels = [
    'button:has-text("Later")','button:has-text("Not now")','button:has-text("Continue")',
    'button:has-text("Close")','button:has-text("Dismiss")','a:has-text("Close")','a:has-text("Dismiss")',
    'button[aria-label*="close" i]','button[title*="close" i]','.modal-header .btn-close',
    '.modal .btn-close','.modal [data-bs-dismiss="modal"]','.modal .close','.modal-backdrop',
  ];
  for (const s of sels) {
    try {
      const el = await page.$(s);
      if (!el) continue;
      if (s === ".modal-backdrop") {
        await page.click(".modal-backdrop", { position: { x: 10, y: 10 }, timeout: 500 }).catch(() => {});
      } else {
        await el.click({ timeout: 800 }).catch(() => {});
      }
      await page.waitForTimeout(200);
    } catch {}
  }
  try { await page.keyboard.press("Escape"); } catch {}
  await page.waitForTimeout(100);
}

async function nukeOverlays(page: import("playwright-core").Page) {
  try {
    await page.evaluate(() => {
      const kill = (el: Element) => el.parentNode?.removeChild(el);
      const all = Array.from(document.querySelectorAll<HTMLElement>("*"));
      for (const el of all) {
        const s = window.getComputedStyle(el);
        const z = parseInt(s.zIndex || "0", 10);
        const dialogish = el.getAttribute("role") === "dialog" || (el.className || "").toLowerCase().includes("modal");
        if ((s.position === "fixed" || s.position === "sticky" || dialogish) && z >= 100) { try { kill(el); } catch {} }
      }
      (document.documentElement as HTMLElement).style.overflow = "auto";
      document.body.style.overflow = "auto";
      (document.body as any).style.pointerEvents = "auto";
    });
  } catch {}
  await page.waitForTimeout(100);
}

function isLoginUrl(url: string) {
  return /\/Account\/Login/i.test(url) || /login\.microsoftonline\.com/i.test(url);
}
async function isLoggedIn(page: import("playwright-core").Page) {
  const url = page.url(); if (isLoginUrl(url)) return false;
  const cues = [
    'text=/Welcome/i','text=/Handicap/i','text=/My Account/i','text=/Sign out/i',
    'a[href*="/account"]','a[href*="/logout"]','a[href*="/dashboard"]',
  ];
  for (const c of cues) { if (await page.$(c)) return true; }
  return false;
}

async function findInFrames(page: import("playwright-core").Page, selectors: string[]) {
  for (const frame of page.frames()) {
    for (const sel of selectors) {
      try { const h = await frame.$(sel); if (h) return { frame, handle: h, selector: sel }; } catch {}
    }
  }
  return null;
}

async function waitForAnyInFrames(
  page: import("playwright-core").Page,
  selectors: string[],
  ms = 10000,
  step = 250
) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const found = await findInFrames(page, selectors);
    if (found) return found;
    await dismissUpgradeModal(page);
    await page.waitForTimeout(step);
  }
  return null;
}

async function snapAsDataUrl(pageOrElement: import("playwright-core").Page | import("playwright-core").ElementHandle, quality = 55) {
  try {
    // @ts-ignore
    const buf = await pageOrElement.screenshot({ type: "jpeg", quality, fullPage: false });
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch { return undefined; }
}

async function saveScreenDoc(runRef: FirebaseFirestore.DocumentReference, payload: {
  label: string; url?: string; title?: string; timestamp?: string; selector?: string; screenshot_b64?: string;
}) { try { await runRef.collection("screens").add({ ...payload, timestamp: payload.timestamp || new Date().toISOString() }); } catch {} }

async function saveHtmlDoc(runRef: FirebaseFirestore.DocumentReference, payload: {
  label: string; url?: string; title?: string; timestamp?: string; htmlSnippet?: string;
}) { try { await runRef.collection("html").add({ ...payload, timestamp: payload.timestamp || new Date().toISOString() }); } catch {} }

async function pageLooksPermissionDenied(page: import("playwright-core").Page) {
  try {
    const title = (await page.title().catch(() => "")) || "";
    if (/permission\s*denied/i.test(title)) return true;
    const txt = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) || "");
    return /permission\s*denied/i.test(txt);
  } catch { return false; }
}

/* -------------------- Login variants -------------------- */

async function loginNative(page: import("playwright-core").Page, email: string, password: string) {
  const emailSels = ['#Email','input[name="Email"]','input[type="email"]','input[name="email"]','input[id*="email"]','input[type="text"]'];
  const passSels  = ['#Password','input[name="Password"]','input[type="password"]','input[id*="password"]','input[name="password"]'];
  const submitSels = ['button[type="submit"]','button:has-text("Log in")','button:has-text("Sign in")','a:has-text("Log in")','input[type="submit"]'];
  const emailFound = await waitForAnyInFrames(page, emailSels, 15000, 300); if (!emailFound) return false;
  await emailFound.handle.fill(email);
  const passFound = await waitForAnyInFrames(page, passSels, 10000, 250); if (!passFound) return false;
  await passFound.handle.fill(password);
  const submitFound = await waitForAnyInFrames(page, submitSels, 6000, 200); if (!submitFound) throw new Error("Login submit button not found (native)");
  try { await submitFound.handle.click(); } catch {}
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  return await isLoggedIn(page);
}

async function loginMicrosoft(page: import("playwright-core").Page, email: string, password: string) {
  const emailSel = (await page.$('#i0116')) || (await page.$('input[name="loginfmt"]')) || (await page.$('input[type="email"]'));
  if (!emailSel) return false;
  await emailSel.fill(email);
  const nextBtn = (await page.$('#idSIButton9')) || (await page.$('input[type="submit"]')) || (await page.$('button:has-text("Next")'));
  if (!nextBtn) throw new Error("Microsoft login: Next not found");
  await nextBtn.click();
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  await dismissUpgradeModal(page);
  const passSel = (await page.$('#i0118')) || (await page.$('input[name="passwd"]')) || (await page.$('input[type="password"]'));
  if (!passSel) throw new Error("Microsoft login: password input not found");
  await passSel.fill(password);
  const signBtn = (await page.$('#idSIButton9')) || (await page.$('input[type="submit"]')) || (await page.$('button:has-text("Sign in")'));
  if (!signBtn) throw new Error("Microsoft login: Sign in button not found");
  await signBtn.click();
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  await dismissUpgradeModal(page);
  const stayNo = await page.$('#idBtn_Back'); if (stayNo) await stayNo.click().catch(() => {}); else { const stayYes = await page.$('#idSIButton9'); if (stayYes) await stayYes.click().catch(() => {}); }
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  return await isLoggedIn(page);
}

/* -------------------- BookingAdd helpers -------------------- */

async function addSelfIfNeeded(page: import("playwright-core").Page) {
  const guesses = ['#btnAddMe','button:has-text("Add me")','button:has-text("Add Myself")','a:has-text("Add me")','a:has-text("Add Myself")','button:has-text("Me")','a:has-text("Me")'];
  for (const sel of guesses) {
    const el = await page.$(sel);
    if (el) { try { await el.scrollIntoViewIfNeeded().catch(() => {}); await el.click({ timeout: 1500 }); await page.waitForTimeout(350); return sel; } catch {} }
  }
  const anyAdd = await page.$$('button:has-text("Add"), a:has-text("Add")').catch(() => []);
  for (const el of anyAdd || []) {
    try { const box = await el.boundingBox(); if (box && box.width > 1 && box.height > 1) { await el.scrollIntoViewIfNeeded().catch(() => {}); await el.click({ timeout: 1500 }); await page.waitForTimeout(350); return 'first-visible "Add"'; } } catch {}
  }
  return null;
}

async function tickConfirmCheckboxes(page: import("playwright-core").Page) {
  const sel = [
    'input[type="checkbox"][name*="term" i]','input[type="checkbox"][id*="term" i]',
    'input[type="checkbox"][name*="agree" i]','input[type="checkbox"][id*="agree" i]',
    'input[type="checkbox"][name*="confirm" i]','input[type="checkbox"][id*="confirm" i]',
  ];
  const toggled: string[] = [];
  for (const css of sel) {
    try {
      const boxes = await page.$$(css);
      for (const b of boxes) {
        const visible = await b.isVisible?.().catch(() => false) || false;
        if (!visible) continue;
        await b.scrollIntoViewIfNeeded?.().catch(() => {});
        await b.click({ timeout: 1000 }).catch(() => {});
        toggled.push(css);
        await page.waitForTimeout(150);
      }
    } catch {}
  }
  return toggled;
}

async function waitForConfirmEnabled(page: import("playwright-core").Page, timeoutMs = 60_000) {
  const btnSel = '#btn-confirm-and-pay';
  const txtSel = '#btn-confirm-and-pay-text';
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const btn = await page.$(btnSel);
      if (btn) {
        const box = await btn.boundingBox(); const visible = !!box && box.width > 1 && box.height > 1;
        if (visible) {
          const disabledAttr = await btn.evaluate((node) => (node as HTMLButtonElement).disabled || (node as Element).hasAttribute('disabled'));
          if (!disabledAttr) {
            const txt = await page.$(txtSel).then(h => h?.textContent() ?? "").catch(() => "");
            return { found: true, enabled: true, txt };
          }
        }
      }
    } catch {}
    await dismissUpgradeModal(page);
    await acceptCookies(page);
    await page.waitForTimeout(500);
  }
  const btn = await page.$(btnSel); if (btn) { const txt = await page.$(txtSel).then(h => h?.textContent() ?? "").catch(() => ""); return { found: true, enabled: false, txt }; }
  return { found: false, enabled: false, txt: '' };
}

async function postConfirmSuccessCue(page: import("playwright-core").Page) {
  const cues = ['text=/Success/i','text=/Confirmed/i','text=/Reserved/i','text=/Booking reference/i','text=/Reservation/i','text=/Thank you/i','text=/completed/i'];
  for (const c of cues) { if (await page.$(c)) return c; } return null;
}

/** Seed clubv1 session by opening a tokened TeeSheet page */
async function seedClubSession(page: import("playwright-core").Page, runRef: FirebaseFirestore.DocumentReference, dateYMD: string, courseId: number, token?: string) {
  const tok = token || process.env.HDIDIDO_TEE_TOKEN || FALLBACK_TOKEN;
  if (!tok) return { attempted: false, ok: false };
  const url = `https://howdidido-whs.clubv1.com/HDIDBooking/TeeSheet?courseId=${courseId}&token=${encodeURIComponent(tok)}&dt=${encodeURIComponent(dateYMD)}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await acceptCookies(page); await dismissUpgradeModal(page);
  await saveScreenDoc(runRef, { label: "after_seed_tee_sheet", url: page.url(), title: await page.title().catch(() => "") || "", screenshot_b64: await snapAsDataUrl(page, 55) });
  const denied = await pageLooksPermissionDenied(page);
  return { attempted: true, ok: !denied, seedUrl: url, denied };
}

/* -------------------- Main handler -------------------- */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const hdr = req.headers.authorization || "";
  if (hdr !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: "Unauthorized" });

  let runRef: FirebaseFirestore.DocumentReference | null = null;
  let outcome: "success" | "failed" = "failed";
  let errorMsg: string | undefined;
  let confirmResult: string | undefined;
  let successCue: string | null | undefined;
  let bookingEvidence: any = {};
  let lastUrl: string | null = null;
  const startedAt = new Date().toISOString();

  try {
    runRef = await firestore.collection("golf_booking_runs").add({
      trigger: "run-now",
      started_at: startedAt,
      user: USER_EMAIL,
      booking_url: BOOKING_ADD_URL,
      status: "in_progress"
    });

    const { default: chromium } = await import("@sparticuz/chromium");
    const playwright = await import("playwright-core");
    const browser = await playwright.chromium.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true });
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    });
    const page = await ctx.newPage();

    const password = process.env.HDIDIDO_PASSWORD || "";
    if (!password) throw new Error("HDIDIDO_PASSWORD env var not set");

    // 1) Login
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await acceptCookies(page); await dismissUpgradeModal(page); await nukeOverlays(page);
    let loggedIn = false;
    if (/login\.microsoftonline\.com/i.test(page.url())) loggedIn = await loginMicrosoft(page, USER_EMAIL, password);
    else { try { loggedIn = await loginNative(page, USER_EMAIL, password); } catch {} if (!loggedIn) loggedIn = await loginMicrosoft(page, USER_EMAIL, password); }

    lastUrl = page.url();
    await saveScreenDoc(runRef, { label: "post_login", url: lastUrl, title: await page.title().catch(() => "") || "", screenshot_b64: await snapAsDataUrl(page, 55) });
    if (!loggedIn) throw new Error("Login not detected (email/password inputs blocked or variant changed).");

    // 2) BookingAdd (first attempt)
    await page.goto(BOOKING_ADD_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await acceptCookies(page); await dismissUpgradeModal(page);

    lastUrl = page.url();
    await saveScreenDoc(runRef, { label: "bookingadd_first", url: lastUrl, title: await page.title().catch(() => "") || "", screenshot_b64: await snapAsDataUrl(page, 55) });
    const htmlPre = await page.content().catch(() => "");
    await saveHtmlDoc(runRef, { label: "pre_confirm_dom", url: lastUrl, title: await page.title().catch(() => "") || "", htmlSnippet: (htmlPre || "").slice(0, 8192) });

    // Permission check; seed if needed
    const deniedFirst = await pageLooksPermissionDenied(page);
    bookingEvidence.permission_denied_first = deniedFirst;
    if (deniedFirst) {
      const seed = await seedClubSession(page, runRef, BOOKING_DATE, COURSE_ID);
      bookingEvidence.seed_attempt = seed;
      // Retry BookingAdd
      await page.goto(BOOKING_ADD_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
      await acceptCookies(page); await dismissUpgradeModal(page);
      lastUrl = page.url();
      await saveScreenDoc(runRef, { label: "bookingadd_retry_after_seed", url: lastUrl, title: await page.title().catch(() => "") || "", screenshot_b64: await snapAsDataUrl(page, 55) });
      bookingEvidence.permission_denied_after_seed = await pageLooksPermissionDenied(page);
      if (bookingEvidence.permission_denied_after_seed) {
        // Bail early with clear evidence
        const htmlDenied = await page.content().catch(() => "");
        await saveHtmlDoc(runRef, { label: "denied_after_seed_dom", url: lastUrl, title: await page.title().catch(() => "") || "", htmlSnippet: (htmlDenied || "").slice(0, 8192) });
        throw new Error("Permission Denied on BookingAdd after seeding club session");
      }
    }

    // 3) Prereqs: add self & tick terms
    const addedSelector = await addSelfIfNeeded(page);
    if (addedSelector) {
      bookingEvidence.added_self_via = addedSelector;
      lastUrl = page.url();
      await saveScreenDoc(runRef, { label: "after_add_self", url: lastUrl, title: await page.title().catch(() => "") || "", screenshot_b64: await snapAsDataUrl(page, 55) });
    }
    const ticked = await tickConfirmCheckboxes(page);
    if (ticked.length) {
      bookingEvidence.ticked_checkboxes = ticked;
      lastUrl = page.url();
      await saveScreenDoc(runRef, { label: "after_tick_checkboxes", url: lastUrl, title: await page.title().catch(() => "") || "", screenshot_b64: await snapAsDataUrl(page, 55) });
    }

    // 4) Wait & click Confirm
    const waitState = await waitForConfirmEnabled(page, 60_000);
    bookingEvidence.confirm_wait = waitState;
    if (waitState.found && waitState.enabled) {
      const btn = await page.$('#btn-confirm-and-pay');
      if (btn) {
        await btn.scrollIntoViewIfNeeded().catch(() => {});
        await btn.click({ timeout: 2500 }).catch(() => {});
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await dismissUpgradeModal(page);
        confirmResult = "confirm_clicked";
      } else {
        confirmResult = "confirm_found_but_clickable_handle_missing";
      }
    } else if (waitState.found && !waitState.enabled) {
      confirmResult = "confirm_found_but_disabled";
    } else {
      confirmResult = "confirm_not_found";
    }

    lastUrl = page.url();
    await saveScreenDoc(runRef, { label: "after_confirm", url: lastUrl, title: await page.title().catch(() => "") || "", screenshot_b64: await snapAsDataUrl(page, 55) });
    const htmlAfter = await page.content().catch(() => "");
    await saveHtmlDoc(runRef, { label: "post_confirm_dom", url: lastUrl, title: await page.title().catch(() => "") || "", htmlSnippet: (htmlAfter || "").slice(0, 8192) });

    successCue = await postConfirmSuccessCue(page);

    await ctx.close(); await browser.close();

    // Persist success
    const finishedAt = new Date().toISOString();
    await runRef.update({
      finished_at: finishedAt,
      outcome: "success",
      status: "success",
      evidence: {
        confirm_result: confirmResult,
        success_cue: successCue,
        booking_evidence: bookingEvidence
      },
      last_url: lastUrl
    });

    outcome = "success";
    return res.status(200).json({ ok: true, outcome, run_id: runRef.id });
  } catch (err: any) {
    errorMsg = err?.message || "Runner error";
    try {
      if (runRef) {
        await runRef.update({
          finished_at: new Date().toISOString(),
          outcome: "failed",
          status: "failed",
          error: errorMsg,
          last_url: lastUrl
        });
      }
    } catch {}
    return res.status(500).json({ ok: false, outcome: "failed", error: errorMsg, run_id: runRef ? runRef.id : null });
  }
}
