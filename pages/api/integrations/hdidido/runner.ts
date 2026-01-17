
// pages/api/integrations/hdidido/runner.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";

/**
 * Direct-to-TeeSheet (no login): open the exact date URL with your courseId and token,
 * click the 06:00 "Book" anchor to reach BookingAdd, then click Confirm.
 * We persist the exact URL we attempted (tee_url_used) and every step's screenshot/HTML.
 *
 * ENV REQUIRED:
 *  - CRON_SECRET
 *  - HDIDIDO_TEE_TOKEN=OI540B8E14I714I969
 * Optional:
 *  - HDIDIDO_TEE_COURSE_ID=12274 (defaults to 12274 if not set)
 */

// --- Hard-coded target date/time for this test run
const BOOKING_DATE = "2026-01-18";
const BOOKING_TIME = "06:00";

// --- Read env + fallbacks
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

function buildTeeSheetDateUrl(dateYMD: string) {
  const token = getToken();
  const courseId = getCourseId(); // ← this is where courseId is set (12274 by default)
  // NOTE: dt IS APPENDED HERE
  return `https://howdidido-whs.clubv1.com/HDIDBooking/TeeSheet?courseId=${courseId}&token=${encodeURIComponent(token)}&dt=${encodeURIComponent(dateYMD)}`;
}

/* -------------------- small helpers -------------------- */
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

/** Find <a data-book="1"> for the tile “YYYY-MM-DD HH:mm” (your DOM), with fallbacks */
async function findBookAnchorForTime(page: import("playwright-core").Page, dateYMD: string, timeHM: string) {
  const dateTime = `${dateYMD} ${timeHM}`;
  const a1 = page.locator(`div.tee.available[data-teetime="${dateTime}"] .controls a[data-book="1"]`).first();
  if (await a1.count().catch(() => 0)) return { anchor: a1, href: await a1.getAttribute("href").catch(() => null) };

  const a2 = page.locator(`a[data-book="1"][data-teetime-selected="${dateTime}"]`).first();
  if (await a2.count().catch(() => 0)) return { anchor: a2, href: await a2.getAttribute("href").catch(() => null) };

  const id = `${dateYMD}-${timeHM.replace(":", "-")}`;
  const a3 = page.locator(`div.tee.available#${id} .controls a[data-book="1"]`).first();
  if (await a3.count().catch(() => 0)) return { anchor: a3, href: await a3.getAttribute("href").catch(() => null) };

  // last resort by visible time label
  const row = page.locator('div.tee.available').filter({ has: page.locator(`.time >> text=${timeHM.replace(/^0/,"")}`) }).first();
  if (await row.count().catch(() => 0)) {
    const a = row.locator('.controls a[data-book="1"]').first();
    if (await a.count().catch(() => 0)) return { anchor: a, href: await a.getAttribute("href").catch(() => null) };
  }
  return null;
}

/** Heuristics for BookingAdd prerequisites */
async function addSelfIfNeeded(page: import("playwright-core").Page) {
  const guesses = ['#btnAddMe','button:has-text("Add me")','button:has-text("Add Myself")','a:has-text("Add me")','a:has-text("Add Myself")','button:has-text("Me")','a:has-text("Me")'];
  for (const sel of guesses) {
    const el = await page.$(sel);
    if (el) { try { await el.scrollIntoViewIfNeeded().catch(() => {}); await el.click({ timeout: 1500 }); await page.waitForTimeout(300); return sel; } catch {} }
  }
  const anyAdd = await page.$$('button:has-text("Add"), a:has-text("Add")').catch(() => []);
  for (const el of anyAdd || []) {
    try { const box = await el.boundingBox(); if (box && box.width > 1 && box.height > 1) { await el.click({ timeout: 1500 }); await page.waitForTimeout(300); return 'first-visible "Add"'; } } catch {}
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

/* -------------------- main handler -------------------- */
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

    // 1) Go straight to *date* TeeSheet (includes dt and courseId=12274)
    const dtUrl = buildTeeSheetDateUrl(BOOKING_DATE);
    await runRef.update({ evidence: { tee_url_used: dtUrl } }); // ← record EXACT URL used
    await page.goto(dtUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    await acceptCookies(page); await dismissOverlays(page);
    lastUrl = page.url();
    await saveScreen(runRef, "teesheet_dt_attempt", page);
    await saveHtml(runRef, "teesheet_dt_dom", page);

    // If the site bounced us to howdidido.com login, record and stop so you can compare
    if (/howdidido\.com\/Account\/Login/i.test(page.url())) {
      await runRef.update({
        status: "failed",
        outcome: "failed",
        error: "Redirected to HowDidiDo login from TeeSheet dt URL",
        last_url: page.url(),
        evidence: { tee_url_used: dtUrl, redirected_to: page.url() }
      });
      await ctx.close(); await browser.close();
      return res.status(200).json({ ok: true, outcome: "failed", note: "Redirected to login", run_id: runRef.id });
    }

    // Guard common server error
    if (await pageLooksPermissionDenied(page) || await looksErrorPage(page)) {
      await saveScreen(runRef, "teesheet_dt_error_or_denied", page);
      throw new Error("TeeSheet dt URL returned Permission Denied / Error without login");
    }

    // 2) Find and click 06:00 "Book"
    const found = await findBookAnchorForTime(page, BOOKING_DATE, BOOKING_TIME);
    if (!found) {
      await saveScreen(runRef, "book_link_not_found", page);
      throw new Error(`Could not find Book link for ${BOOKING_DATE} ${BOOKING_TIME}`);
    }
    try {
      await found.anchor.scrollIntoViewIfNeeded().catch(() => {});
      await Promise.race([
        page.waitForURL(/\/HDIDBooking\/BookingAdd/i, { timeout: 15000 }),
        found.anchor.click({ timeout: 2500 }).then(() => page.waitForURL(/\/HDIDBooking\/BookingAdd/i, { timeout: 15000 }).catch(() => {})),
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
    if (!/\/HDIDBooking\/BookingAdd/i.test(page.url())) throw new Error("Did not reach BookingAdd");

    // 3) BookingAdd: add self, tick terms, wait & click Confirm
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
        tee_url_used: dtUrl,
        step: "direct_dt->book->bookingadd->confirm",
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
