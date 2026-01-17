
// pages/api/integrations/hdidido/runner.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";

/**
 * Strict flow:
 *  1) Login (native + Microsoft/Azure) as Ben (env creds).
 *  2) GOTO ONLY the exact TeeSheet DATE URL (courseId=12274, token, dt=2026-01-18).
 *     - If redirected/denied/error → FAIL immediately (no root teesheet, no alternate URLs).
 *     - Persist requested & resulting URLs.
 *  3) Click 06:00 "Book" anchor to reach BookingAdd.
 *     - Persist requested (anchor href) & resulting URL.
 *     - If not BookingAdd, repair once (href absolute or reconstructed BookingAdd URL).
 *  4) On BookingAdd: add self (heuristic), tick terms/confirm checkboxes, wait up to 60s for Confirm, click.
 *  5) Persist run in Firestore: golf_booking_runs + subcollections 'screens' and 'html'.
 */

const LOGIN_URL = "https://www.howdidido.com/Account/Login";

// Hard-coded target for the current run
const BOOKING_DATE = "2026-01-18"; // YYYY-MM-DD
const BOOKING_TIME = "06:00";      // HH:mm (24h)

// -------------------- Env & URL builders --------------------

function getEmail(): string {
  const e = process.env.HDIDIDO_EMAIL;
  if (!e) throw new Error("HDIDIDO_EMAIL env var not set");
  return e;
}
function getPassword(): string {
  const p = process.env.HDIDIDO_PASSWORD;
  if (!p) throw new Error("HDIDIDO_PASSWORD env var not set");
  return p;
}
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

/** EXACT TeeSheet DATE URL (the only post-login URL we open) */
function buildTeeSheetDateUrl(dateYMD: string) {
  const token = getToken();
  const courseId = getCourseId();
  return `https://howdidido-whs.clubv1.com/HDIDBooking/TeeSheet?courseId=${courseId}&token=${encodeURIComponent(
    token
  )}&dt=${encodeURIComponent(dateYMD)}`;
}

/** Construct a BookingAdd URL if we must repair navigation */
function toBookingAddUrl(dateYMD: string, timeHM: string, courseId: number) {
  const dt = encodeURIComponent(`${dateYMD}T${timeHM}`); // encodes ":" to %3A
  return `https://howdidido-whs.clubv1.com/HDIDBooking/BookingAdd?dateTime=${dt}&courseId=${courseId}` +
         `&startPoint=1&crossOverStartPoint=0&crossOverMinutes=0&releasedReservation=False`;
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
async function waitForAnyInFrames(page: import("playwright-core").Page, selectors: string[], ms = 12000, step = 250) {
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

// -------------------- Login (Ben's env creds) --------------------

async function loginNative(page: import("playwright-core").Page, email: string, password: string) {
  const emailSels = ['#Email','input[name="Email"]','input[type="email"]','input[name="email"]','input[id*="email"]','input[type="text"]'];
  const passSels  = ['#Password','input[name="Password"]','input[type="password"]','input[id*="password"]','input[name="password"]'];
  const submitSels= ['button[type="submit"]','button:has-text("Log in")','button:has-text("Sign in")','a:has-text("Log in")','input[type="submit"]'];

  const emailFound = await waitForAnyInFrames(page, emailSels, 15000, 300); if (!emailFound) return false;
  await emailFound.handle.fill(email);
  const passFound  = await waitForAnyInFrames(page, passSels, 8000, 250); if (!passFound) return false;
  await passFound.handle.fill(password);
  const submitFound= await waitForAnyInFrames(page, submitSels, 6000, 200); if (!submitFound) throw new Error("Login submit button not found (native)");
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
  await dismissOverlays(page);
  const passSel = (await page.$('#i0118')) || (await page.$('input[name="passwd"]')) || (await page.$('input[type="password"]'));
  if (!passSel) throw new Error("Microsoft login: password input not found");
  await passSel.fill(password);
  const signBtn = (await page.$('#idSIButton9')) || (await page.$('input[type="submit"]')) || (await page.$('button:has-text("Sign in")'));
  if (!signBtn) throw new Error("Microsoft login: Sign in button not found");
  await signBtn.click();
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  await dismissOverlays(page);
  const stayNo = await page.$('#idBtn_Back'); if (stayNo) { await stayNo.click().catch(() => {}); }
  else { const stayYes = await page.$('#idSIButton9'); if (stayYes) await stayYes.click().catch(() => {}); }
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  return await isLoggedIn(page);
}

// -------------------- TeeSheet & Booking helpers --------------------

/** Your DOM: find the "Book" anchor for the target tile */
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
      user: getEmail(),
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

    const email = getEmail();
    const password = getPassword();

    // ---------------- 1) LOGIN ----------------
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await acceptCookies(page); await dismissOverlays(page); await nukeOverlays(page);

    let loggedIn = false;
    try { loggedIn = await loginNative(page, email, password); } catch {}
    if (!loggedIn) { loggedIn = await loginMicrosoft(page, email, password); }

    lastUrl = page.url();
    await saveScreen(runRef, "post_login", page);
    if (!loggedIn) throw new Error("Login not detected");

    // ---------------- 2) TeeSheet DATE URL (ONLY) ----------------
    const dtUrl = buildTeeSheetDateUrl(BOOKING_DATE); // EXACT URL
    await runRef.update({ tee_requested_url: dtUrl });

    await page.goto(dtUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    await acceptCookies(page); await dismissOverlays(page);

    const afterDt = page.url();
    await runRef.update({ tee_resulting_url: afterDt });

    await saveScreen(runRef, "teesheet_dt_attempt", page);
    await saveHtml(runRef, "teesheet_dt_dom", page);

    // STRICT failure conditions (no other navigation!)
    if (/howdidido\.com\/Account\/Login/i.test(afterDt)) {
      await saveScreen(runRef, "teesheet_dt_redirected_to_login", page);
      throw new Error("Redirected to HowDidiDo login from TeeSheet DATE URL");
    }
    if (await pageLooksPermissionDenied(page)) {
      await saveScreen(runRef, "teesheet_dt_permission_denied", page);
      throw new Error("Permission Denied on TeeSheet DATE URL");
    }
    if (await looksErrorPage(page)) {
      await saveScreen(runRef, "teesheet_dt_error_page", page);
      throw new Error("Error page on TeeSheet DATE URL");
    }

    // Verify tiles exist for the date
    const hasDayTiles =
      (await page.locator(`div.tee.available[data-teetime^="${BOOKING_DATE}"]`).count().catch(() => 0)) > 0 ||
      (await page.locator(`div.tee[data-teetime^="${BOOKING_DATE}"]`).count().catch(() => 0)) > 0;
    if (!hasDayTiles) {
      await saveScreen(runRef, "teesheet_dt_no_day_tiles", page);
      throw new Error(`No tiles for ${BOOKING_DATE} visible on TeeSheet date page.`);
    }

    // ---------------- 3) Click 06:00 "Book" (record requested & resulting URLs) ----------------
    const found = await findBookAnchorForTime(page, BOOKING_DATE, BOOKING_TIME);
    if (!found) {
      await saveScreen(runRef, "book_link_not_found", page);
      throw new Error(`Could not find "Book" link for ${BOOKING_DATE} ${BOOKING_TIME}`);
    }

    const bookHref = (await found.anchor.getAttribute("href").catch(() => found.href || null)) || "(anchor click only)";
    await runRef.update({ bookingadd_requested_url: bookHref });

    try {
      await found.anchor.scrollIntoViewIfNeeded().catch(() => {});
      await Promise.race([
        page.waitForURL(/\/HDIDBooking\/BookingAdd/i, { timeout: 15000 }),
        found.anchor.click({ timeout: 2500 }).then(() =>
          page.waitForURL(/\/HDIDBooking\/BookingAdd/i, { timeout: 15000 }).catch(() => {})
        ),
      ]);
    } catch { /* proceed to repair if needed */ }

    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    await acceptCookies(page); await dismissOverlays(page);

    const afterBook = page.url();
    await runRef.update({ bookingadd_resulting_url: afterBook });

    let atBookingAdd = /\/HDIDBooking\/BookingAdd/i.test(afterBook);

    // If site sent us elsewhere (/Booking), repair once
    if (!atBookingAdd) {
      let repairUrl: string | null = null;
      if (bookHref && bookHref !== "(anchor click only)") {
        repairUrl = new URL(bookHref, "https://howdidido-whs.clubv1.com").toString();
      } else {
        repairUrl = toBookingAddUrl(BOOKING_DATE, BOOKING_TIME, getCourseId());
      }

      await runRef.update({
        bookingadd_repair_attempt: repairUrl,
        bookingadd_repair_reason: "resulting_url_was_not_bookingadd"
      });

      await page.goto(repairUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
      await acceptCookies(page); await dismissOverlays(page);

      const repaired = page.url();
      await runRef.update({ bookingadd_repaired_resulting_url: repaired });
      await saveScreen(runRef, "bookingadd_repaired", page);
      await saveHtml(runRef, "bookingadd_repaired_dom", page);

      if (!/\/HDIDBooking\/BookingAdd/i.test(repaired)) {
        throw new Error(`Repair did not land on BookingAdd (now at: ${repaired})`);
      }
      atBookingAdd = true;
    }

    await saveScreen(runRef, "bookingadd_from_teesheet", page);
    await saveHtml(runRef, "bookingadd_dom", page);

    // ---------------- 4) BookingAdd: pre-reqs & Confirm ----------------
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
        step: "login->teesheet_dt_only->book->bookingadd->confirm",
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
