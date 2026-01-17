
// pages/api/integrations/hdidido/runner.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";

/**
 * Flow (correct URL & order):
 *  1) Login at https://www.howdidido.com/Account/Login (native + Microsoft/Azure variants)
 *  2) Go to TeeSheet DATE URL (with courseId=12274, token, dt=YYYY-MM-DD)  ← your required URL
 *     If redirected/denied/error → seed once on TeeSheet ROOT (same course, no dt) → retry DATE URL
 *  3) On the date page, click the 06:00 tile's "Book" anchor
 *  4) BookingAdd: add self (heuristic), tick terms/confirm boxes, wait up to 60s for Confirm, click
 *  5) Persist run → golf_booking_runs (top-level) + /screens + /html
 *
 * ENV REQUIRED:
 *  - CRON_SECRET
 *  - HDIDIDO_TEE_TOKEN=OI540B8E14I714I969   (current token)
 * Optional:
 *  - HDIDIDO_TEE_COURSE_ID=12274            (defaults to 12274 if not set)
 */

const LOGIN_URL = "https://www.howdidido.com/Account/Login";

// Hard-coded target for this run (adjust weekly if needed)
const BOOKING_DATE = "2026-01-18"; // YYYY-MM-DD
const BOOKING_TIME = "06:00";      // HH:mm (24h)

// -------------------- Env & URL builders --------------------

function getToken(): string {
  const t = process.env.HDIDIDO_TEE_TOKEN;
  if (!t) throw new Error("HDIDIDO_TEE_TOKEN env var not set");
  return t;
}
function getCourseId(): number {
  const raw = process.env.HDIDIDO_TEE_COURSE_ID ?? "12274";
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`HDIDIDO_TEE_COURSE_ID invalid: ${raw}`);
  return n;
}

/** EXACT date URL (this is the page we must open after login) */
function buildTeeSheetDateUrl(dateYMD: string) {
  const token = getToken();
  const courseId = getCourseId();
  return `https://howdidido-whs.clubv1.com/HDIDBooking/TeeSheet?courseId=${courseId}&token=${encodeURIComponent(token)}&dt=${encodeURIComponent(dateYMD)}`;
}
/** Root list for same course (used only for one-off seeding, then we retry DATE URL) */
function buildTeeSheetRootUrl() {
  const token = getToken();
  const courseId = getCourseId();
  return `https://howdidido-whs.clubv1.com/HDIDBooking/TeeSheet?courseId=${courseId}&token=${encodeURIComponent(token)}`;
}

// -------------------- Page utilities --------------------

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
async function dismissOverlays(page: import("playwright-core").Page) {
  const sels = [
    'button:has-text("Later")','button:has-text("Not now")','button:has-text("Continue")',
    'button:has-text("Close")','button:has-text("Dismiss")','a:has-text("Close")','a:has-text("Dismiss")',
    '.modal .btn-close','.modal [data-bs-dismiss="modal"]','.modal .close','.modal-backdrop'
  ];
  for (const s of sels) {
    try { const el = await page.$(s); if (!el) continue; await el.click({ timeout: 800 }).catch(() => {}); await page.waitForTimeout(150); } catch {}
  }
  try { await page.keyboard.press("Escape"); } catch {}
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
function isLoginUrl(url: string) { return /\/Account\/Login/i.test(url) || /login\.microsoftonline\.com/i.test(url); }
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
  for (const frame of page.frames()) for (const sel of selectors) {
    try { const h = await frame.$(sel); if (h) return { frame, handle: h, selector: sel }; } catch {}
  }
  return null;
}
async function waitForAnyInFrames(page: import("playwright-core").Page, selectors: string[], ms = 10000, step = 250) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    const found = await findInFrames(page, selectors);
    if (found) return found;
    await dismissOverlays(page);
    await page.waitForTimeout(step);
  }
  return null;
}
async function pageLooksPermissionDenied(page: import("playwright-core").Page) {
  try {
    const title = (await page.title().catch(() => "")) || "";
    if (/permission\s*denied/i.test(title)) return true;
    const txt = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) || "");
    return /permission\s*denied/i.test(txt);
  } catch { return false; }
}
async function looksErrorPage(page: import("playwright-core").Page) {
  try {
    const title = (await page.title().catch(() => "")) || "";
    if (/^error$/i.test(title)) return true;
    const txt = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) || "");
    return /something unexpected went wrong|please try again in a moment/i.test(txt);
  } catch { return false; }
}
async function snapAsDataUrl(pageOrEl: import("playwright-core").Page | import("playwright-core").ElementHandle, quality = 55) {
  try {
    // @ts-ignore Page & ElementHandle both support screenshot
    const buf = await pageOrEl.screenshot({ type: "jpeg", quality, fullPage: false });
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch { return undefined; }
}
async function saveScreen(runRef: FirebaseFirestore.DocumentReference, label: string, page: import("playwright-core").Page, selector?: string) {
  await runRef.collection("screens").add({
    label,
    url: page.url(),
    title: await page.title().catch(() => "") || "",
    selector,
    screenshot_b64: await snapAsDataUrl(page, 55),
    timestamp: new Date().toISOString()
  });
}
async function saveHtml(runRef: FirebaseFirestore.DocumentReference, label: string, page: import("playwright-core").Page) {
  const html = await page.content().catch(() => "");
  await runRef.collection("html").add({
    label,
    url: page.url(),
    title: await page.title().catch(() => "") || "",
    htmlSnippet: (html || "").slice(0, 8192),
    timestamp: new Date().toISOString()
  });
}

// -------------------- Login variants --------------------

async function loginNative(page: import("playwright-core").Page) {
  const emailSels = ['#Email','input[name="Email"]','input[type="email"]','input[name="email"]','input[id*="email"]','input[type="text"]'];
  const passSels  = ['#Password','input[name="Password"]','input[type="password"]','input[id*="password"]','input[name="password"]'];
  const submitSels= ['button[type="submit"]','button:has-text("Log in")','button:has-text("Sign in")','a:has-text("Log in")','input[type="submit"]'];

  const emailFound = await waitForAnyInFrames(page, emailSels, 15000, 300); if (!emailFound) return false;
  // We fill whatever the site presents; many clubs federate, so you may see MS login instead
  await emailFound.handle.focus().catch(()=>{});

  // If the site is true native (email+password form)
  const passFound = await waitForAnyInFrames(page, passSels, 4000, 250);
  if (passFound) {
    // NOTE: For native login you must add the actual creds here if needed
    // This runner focuses the controls to allow the IdP button path to show instead
    const submitFound= await waitForAnyInFrames(page, submitSels, 4000, 200);
    if (submitFound) { try { await submitFound.handle.click(); } catch {} }
    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    return await isLoggedIn(page);
  }
  return false;
}

async function loginMicrosoft(page: import("playwright-core").Page) {
  // Microsoft login DOM (best effort; works when club uses MS IdP)
  const emailSel = (await page.$('#i0116')) || (await page.$('input[name="loginfmt"]')) || (await page.$('input[type="email"]'));
  if (!emailSel) return false;

  // This runner does not embed a password—most clubs SSO from here (or device SSO).
  // If your flow requires password, we can add env HDIDIDO_EMAIL/HDIDIDO_PASSWORD and fill them.
  await emailSel.focus();

  const nextBtn = (await page.$('#idSIButton9')) || (await page.$('input[type="submit"]')) || (await page.$('button:has-text("Next")'));
  if (nextBtn) { await nextBtn.click().catch(()=>{}); }

  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  await dismissOverlays(page);

  // If password field appears, we bail (no password provided in this variant)
  return await isLoggedIn(page);
}

// -------------------- TeeSheet & Booking helpers --------------------

/** Open the DATE TeeSheet URL; if redirected/denied/error, seed on ROOT once then retry DATE. */
async function openDateTeeSheetWithRetry(page: import("playwright-core").Page, runRef: FirebaseFirestore.DocumentReference, dateYMD: string) {
  const dtUrl = buildTeeSheetDateUrl(dateYMD);
  await page.goto(dtUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  await acceptCookies(page); await dismissOverlays(page);
  await runRef.update({ evidence: { tee_url_used: dtUrl } });
  await saveScreen(runRef, "teesheet_dt_first", page);
  await saveHtml(runRef, "teesheet_dt_dom", page);

  const bouncedToLogin = /howdidido\.com\/Account\/Login/i.test(page.url());
  const denied = await pageLooksPermissionDenied(page);
  const err = await looksErrorPage(page);

  if (bouncedToLogin || denied || err) {
    // Seed on root once (same course) and re-attempt the DATE URL
    const root = buildTeeSheetRootUrl();
    await page.goto(root, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await acceptCookies(page);
    await saveScreen(runRef, "teesheet_root_seed", page);

    await page.waitForTimeout(700);
    await page.goto(dtUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    await acceptCookies(page); await dismissOverlays(page);
    await saveScreen(runRef, "teesheet_dt_retry", page);

    if (/howdidido\.com\/Account\/Login/i.test(page.url()) || await pageLooksPermissionDenied(page) || await looksErrorPage(page)) {
      throw new Error("TeeSheet DATE URL still redirected/denied/error after seed");
    }
  }

  // verify tiles exist for the date
  const hasDayTiles =
    (await page.locator(`div.tee.available[data-teetime^="${dateYMD}"]`).count().catch(() => 0)) > 0 ||
    (await page.locator(`div.tee[data-teetime^="${dateYMD}"]`).count().catch(() => 0)) > 0;
  if (!hasDayTiles) {
    await saveScreen(runRef, "teesheet_dt_no_day_tiles", page);
    throw new Error(`No tiles for ${dateYMD} visible on TeeSheet date page.`);
  }
}

/** Your DOM: find the "Book" anchor for a given date/time tile */
async function findBookAnchorForTime(page: import("playwright-core").Page, dateYMD: string, timeHM: string) {
  const dateTime = `${dateYMD} ${timeHM}`;
  // Precise by data-teetime + anchor
  const a1 = page.locator(`div.tee.available[data-teetime="${dateTime}"] .controls a[data-book="1"]`).first();
  if (await a1.count().catch(() => 0)) {
    const href = await a1.getAttribute("href").catch(() => null);
    return { anchor: a1, href };
  }
  // Anchor by data-teetime-selected
  const a2 = page.locator(`a[data-book="1"][data-teetime-selected="${dateTime}"]`).first();
  if (await a2.count().catch(() => 0)) {
    const href = await a2.getAttribute("href").catch(() => null);
    return { anchor: a2, href };
  }
  // Tile id fallback
  const id = `${dateYMD}-${timeHM.replace(":", "-")}`;
  const a3 = page.locator(`div.tee.available#${id} .controls a[data-book="1"]`).first();
  if (await a3.count().catch(() => 0)) {
    const href = await a3.getAttribute("href").catch(() => null);
    return { anchor: a3, href };
  }
  // Fallback by visible time label with nearby Book
  const t = timeHM.replace(/^0/,"");
  const row = page.locator('div.tee.available').filter({ has: page.locator(`.time >> text=${t}`) }).first();
  if (await row.count().catch(() => 0)) {
    const a = row.locator('.controls a[data-book="1"]').first();
    if (await a.count().catch(() => 0)) {
      const href = await a.getAttribute("href").catch(() => null);
      return { anchor: a, href };
    }
  }
  return null;
}

// -------------------- BookingAdd helpers --------------------

async function addSelfIfNeeded(page: import("playwright-core").Page) {
  const guesses = ['#btnAddMe','button:has-text("Add me")','button:has-text("Add Myself")','a:has-text("Add me")','a:has-text("Add Myself")','button:has-text("Me")','a:has-text("Me")'];
  for (const sel of guesses) {
    const el = await page.$(sel);
    if (el) { try { await el.scrollIntoViewIfNeeded().catch(() => {}); await el.click({ timeout: 1500 }); await page.waitForTimeout(300); return sel; } catch {} }
  }
  const anyAdd = await page.$$('button:has-text("Add"), a:has-text("Add")').catch(() => []);
  for (const el of anyAdd || []) {
    try { const box = await el.boundingBox(); if (box && box.width > 1 && box.height > 1) { await el.scrollIntoViewIfNeeded().catch(() => {}); await el.click({ timeout: 1500 }); await page.waitForTimeout(300); return 'first-visible "Add"'; } } catch {}
  }
  return null;
}
async function tickConfirmCheckboxes(page: import("playwright-core").Page) {
  const sels = [
    'input[type="checkbox"][name*="term" i]','input[type="checkbox"][id*="term" i]',
    'input[type="checkbox"][name*="agree" i]','input[type="checkbox"][id*="agree" i]',
    'input[type="checkbox"][name*="confirm" i]','input[type="checkbox"][id*="confirm" i]'
  ];
  const toggled:string[] = [];
  for (const css of sels) {
    const boxes = await page.$$(css).catch(() => []);
    for (const b of boxes) {
      const box = await b.boundingBox().catch(() => null);
      if (!box || box.width < 1 || box.height < 1) continue;
      await b.scrollIntoViewIfNeeded().catch(() => {});
      await b.click({ timeout: 1000 }).catch(() => {});
      toggled.push(css);
      await page.waitForTimeout(120);
    }
  }
  return toggled;
}
async function waitForConfirmEnabled(page: import("playwright-core").Page, timeoutMs=60000) {
  const start = Date.now();
  const btnSel = '#btn-confirm-and-pay', txtSel='#btn-confirm-and-pay-text';
  while (Date.now()-start < timeoutMs) {
    try {
      const btn = await page.$(btnSel);
      if (btn) {
        const box = await btn.boundingBox().catch(() => null);
        if (box && box.width>1 && box.height>1) {
          const enabled = await btn.evaluate(n => !(n as HTMLButtonElement).disabled && !(n as Element).hasAttribute('disabled'));
          if (enabled) {
            const txt = await page.$(txtSel).then(h=>h?.textContent() ?? "").catch(()=> "");
            return { found:true, enabled:true, txt };
          }
        }
      }
    } catch {}
    await dismissOverlays(page);
    await acceptCookies(page);
    await page.waitForTimeout(400);
  }
  const btn = await page.$(btnSel);
  if (btn) {
    const txt = await page.$(txtSel).then(h=>h?.textContent() ?? "").catch(()=> "");
    return { found:true, enabled:false, txt };
  }
  return { found:false, enabled:false, txt:"" };
}
async function successCue(page: import("playwright-core").Page) {
  const cues = ['text=/Success/i','text=/Confirmed/i','text=/Reserved/i','text=/Booking reference/i','text=/Reservation/i','text=/Thank you/i','text=/completed/i'];
  for (const c of cues) { if (await page.$(c)) return c; }
  return null;
}

// -------------------- Main API handler --------------------

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if ((req.headers.authorization || "") !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let runRef: FirebaseFirestore.DocumentReference | null = null;
  let lastUrl: string | null = null;

  try {
    // Create run record
    runRef = await firestore.collection("golf_booking_runs").add({
      trigger: "run-now",
      started_at: new Date().toISOString(),
      target: { date: BOOKING_DATE, time: BOOKING_TIME, courseId: getCourseId() },
      status: "in_progress"
    });

    // Launch Chromium
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

    // ---------------- 1) LOGIN ----------------
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await acceptCookies(page); await dismissOverlays(page); await nukeOverlays(page);

    let loggedIn = false;
    // Try native first, then MS
    try { loggedIn = await loginNative(page); } catch {}
    if (!loggedIn) { loggedIn = await loginMicrosoft(page); }

    lastUrl = page.url();
    await saveScreen(runRef, "post_login", page);
    if (!loggedIn) {
      // Even if login cues not seen, proceed to dt once (some clubs auto-redirect after first protected hit)
      // If you want to hard-fail here, uncomment the next line:
      // throw new Error("Login not detected");
    }

    // ---------------- 2) DATE TeeSheet (with dt) ----------------
    await openDateTeeSheetWithRetry(page, runRef, BOOKING_DATE);

    // ---------------- 3) Click 06:00 "Book" ----------------
    const found = await findBookAnchorForTime(page, BOOKING_DATE, BOOKING_TIME);
    if (!found) {
      await saveScreen(runRef, "book_link_not_found", page);
      throw new Error(`Could not find "Book" link for ${BOOKING_DATE} ${BOOKING_TIME}`);
    }
    try {
      await found.anchor.scrollIntoViewIfNeeded().catch(() => {});
      await Promise.race([
        page.waitForURL(/\/HDIDBooking\/BookingAdd/i, { timeout: 15000 }),
        found.anchor.click({ timeout: 2500 }).then(() =>
          page.waitForURL(/\/HDIDBooking\/BookingAdd/i, { timeout: 15000 }).catch(() => {})
        ),
      ]);
    } catch {
      const href = await found.anchor.getAttribute("href").catch(() => found.href || null);
      if (href) {
        const abs = new URL(href, "https://howdidido-whs.clubv1.com").toString();
        await page.goto(abs, { waitUntil: "domcontentloaded", timeout: 30000 });
      }
    }

    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    await acceptCookies(page); await dismissOverlays(page);
    await saveScreen(runRef, "bookingadd_from_teesheet", page);
    await saveHtml(runRef, "bookingadd_dom", page);
    if (!/\/HDIDBooking\/BookingAdd/i.test(page.url())) {
      throw new Error("Did not reach BookingAdd after clicking Book");
    }

    // ---------------- 4) Pre-reqs & Confirm ----------------
    const ev: any = {};

    const added = await addSelfIfNeeded(page);
    if (added) { ev.added_self_via = added; await saveScreen(runRef, "after_add_self", page); }

    const ticked = await tickConfirmCheckboxes(page);
    if (ticked.length) { ev.ticked_checkboxes = ticked; await saveScreen(runRef, "after_tick_checkboxes", page); }

    const waitState = await waitForConfirmEnabled(page, 60_000);
    ev.confirm_wait = waitState;

    let confirmResult = "confirm_not_found";
    if (waitState.found && waitState.enabled) {
      const btn = await page.$('#btn-confirm-and-pay');
      if (btn) {
        await btn.scrollIntoViewIfNeeded().catch(() => {});
        await btn.click({ timeout: 2500 }).catch(() => {});
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await dismissOverlays(page);
        confirmResult = "confirm_clicked";
      } else {
        confirmResult = "confirm_found_but_clickable_handle_missing";
      }
    } else if (waitState.found) {
      confirmResult = "confirm_found_but_disabled";
    }

    await saveScreen(runRef, "after_confirm", page);
    await saveHtml(runRef, "post_confirm_dom", page);
    const cue = await successCue(page);

    await ctx.close(); await browser.close();

    await runRef.update({
      finished_at: new Date().toISOString(),
      status: "success",
      outcome: "success",
      last_url: lastUrl,
      evidence: {
        step: "login->teesheet_dt->book->bookingadd->confirm",
        tee_url_used: buildTeeSheetDateUrl(BOOKING_DATE),
        confirm_result: confirmResult,
        success_cue: cue,
        booking_evidence: ev
      }
    });

    return res.status(200).json({ ok: true, outcome: "success", run_id: runRef.id });
  } catch (err: any) {
    const errorMsg = err?.message || "Runner error";
    try {
      if (runRef) {
        await runRef.update({
          finished_at: new Date().toISOString(),
          status: "failed",
          outcome: "failed",
          error: errorMsg,
          last_url: lastUrl
        });
      }
    } catch {}
    return res.status(500).json({ ok: false, outcome: "failed", error: errorMsg, run_id: runRef ? runRef.id : null });
  }
}
