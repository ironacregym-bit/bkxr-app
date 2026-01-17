
// pages/api/integrations/hdidido/runner.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";

/**
 * Direct path (no HowDidiDo login):
 *  1) Open TeeSheet date URL: /HDIDBooking/TeeSheet?courseId=0&token=...&dt=YYYY-MM-DD
 *  2) Find 06:00 tee tile -> click its "Book" anchor (a[data-book="1"])
 *  3) On BookingAdd: add self (heuristic), tick terms, wait up to 60s for "Confirm" and click
 *  4) Persist run in Firestore: golf_booking_runs + subcollections 'screens' and 'html'
 *
 * ENV REQUIRED:
 *  - CRON_SECRET
 *  - HDIDIDO_TEE_TOKEN  (club token; will fallback to HARD_CODED_TOKEN if not set)
 */

// --- Hard-coded smoke target for this run
const BOOKING_DATE = "2026-01-18"; // YYYY-MM-DD
const BOOKING_TIME = "06:00";      // HH:mm (24h)
const COURSE_ID = 12274;           // in the BookingAdd URL (not needed for TeeSheet list)

// --- Optional fallback token if env missing (prefer env!)
const HARD_CODED_TOKEN = "OI540B8E14I714I969";

/* -------------------- Utilities -------------------- */

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
async function snapAsDataUrl(
  pageOrElement: import("playwright-core").Page | import("playwright-core").ElementHandle,
  quality = 55
) {
  try {
    // @ts-ignore - both Page and ElementHandle support screenshot
    const buf = await pageOrElement.screenshot({ type: "jpeg", quality, fullPage: false });
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch { return undefined; }
}
async function saveScreenDoc(runRef: FirebaseFirestore.DocumentReference, payload: { label: string; url?: string; title?: string; selector?: string; screenshot_b64?: string; }) {
  try { await runRef.collection("screens").add({ ...payload, timestamp: new Date().toISOString() }); } catch {}
}
async function saveHtmlDoc(runRef: FirebaseFirestore.DocumentReference, payload: { label: string; url?: string; title?: string; htmlSnippet?: string; }) {
  try { await runRef.collection("html").add({ ...payload, timestamp: new Date().toISOString() }); } catch {}
}

/* -------------------- TeeSheet & Booking helpers -------------------- */

// Build the exact TeeSheet date URL (courseId=0, token, dt)
function buildTeeSheetDateUrl(dateYMD: string) {
  const token = process.env.HDIDIDO_TEE_TOKEN || HARD_CODED_TOKEN;
  return `https://howdidido-whs.clubv1.com/HDIDBooking/TeeSheet?courseId=0&token=${encodeURIComponent(token)}&dt=${encodeURIComponent(dateYMD)}`;
}

/** Find the "Book" anchor for a given date/time tile (from your DOM) */
async function findBookAnchorForTime(page: import("playwright-core").Page, dateYMD: string, timeHM: string) {
  const dateTime = `${dateYMD} ${timeHM}`;
  const timeVariants = [timeHM.replace(/^0/, ""), timeHM];

  // 1) Precise: data-teetime + anchor
  const a1 = page.locator(`div.tee.available[data-teetime="${dateTime}"] .controls a[data-book="1"]`).first();
  if (await a1.count().catch(() => 0)) {
    const href = await a1.getAttribute("href").catch(() => null);
    return { anchor: a1, href };
  }

  // 2) Anchor by data-teetime-selected
  const a2 = page.locator(`a[data-book="1"][data-teetime-selected="${dateTime}"]`).first();
  if (await a2.count().catch(() => 0)) {
    const href = await a2.getAttribute("href").catch(() => null);
    return { anchor: a2, href };
  }

  // 3) Tile by id "YYYY-MM-DD-HH-00", then anchor in .controls
  const id = `${dateYMD}-${timeHM.replace(":", "-")}`;
  const a3 = page.locator(`div.tee.available#${id} .controls a[data-book="1"]`).first();
  if (await a3.count().catch(() => 0)) {
    const href = await a3.getAttribute("href").catch(() => null);
    return { anchor: a3, href };
  }

  // 4) Fallback: by visible `.time` label with "Book" nearby
  for (const t of timeVariants) {
    const row = page.locator('div.tee.available').filter({ has: page.locator(`.time >> text=${t}`) }).first();
    if (await row.count().catch(() => 0)) {
      const a = row.locator('.controls a[data-book="1"]').first();
      if (await a.count().catch(() => 0)) {
        const href = await a.getAttribute("href").catch(() => null);
        return { anchor: a, href };
      }
    }
  }

  return null;
}

async function addSelfIfNeeded(page: import("playwright-core").Page) {
  const guesses = [
    '#btnAddMe','button:has-text("Add me")','button:has-text("Add Myself")',
    'a:has-text("Add me")','a:has-text("Add Myself")','button:has-text("Me")','a:has-text("Me")'
  ];
  for (const sel of guesses) {
    const el = await page.$(sel);
    if (el) {
      try { await el.scrollIntoViewIfNeeded().catch(() => {}); await el.click({ timeout: 1500 }); await page.waitForTimeout(350); return sel; } catch {}
    }
  }
  const anyAdd = await page.$$('button:has-text("Add"), a:has-text("Add")').catch(() => []);
  for (const el of anyAdd || []) {
    try {
      const box = await el.boundingBox();
      if (box && box.width > 1 && box.height > 1) {
        await el.scrollIntoViewIfNeeded().catch(() => {});
        await el.click({ timeout: 1500 });
        await page.waitForTimeout(350);
        return 'first-visible "Add"';
      }
    } catch {}
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
    const boxes = await page.$$(css).catch(() => []);
    for (const b of boxes) {
      const box = await b.boundingBox().catch(() => null);
      if (!box || box.width < 1 || box.height < 1) continue;
      await b.scrollIntoViewIfNeeded().catch(() => {});
      await b.click({ timeout: 1000 }).catch(() => {});
      toggled.push(css);
      await page.waitForTimeout(150);
    }
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
        const box = await btn.boundingBox().catch(() => null);
        const visible = !!box && box.width > 1 && box.height > 1;
        if (visible) {
          const disabledAttr = await btn.evaluate((node) =>
            (node as HTMLButtonElement).disabled || (node as Element).hasAttribute('disabled')
          );
          if (!disabledAttr) {
            const txt = await page.$(txtSel).then(h => h?.textContent() ?? "").catch(() => "");
            return { found: true, enabled: true, txt };
          }
        }
      }
    } catch {}
    await dismissUpgradeModal(page); await acceptCookies(page); await page.waitForTimeout(500);
  }
  const btn = await page.$(btnSel);
  if (btn) {
    const txt = await page.$(txtSel).then(h => h?.textContent() ?? "").catch(() => "");
    return { found: true, enabled: false, txt };
  }
  return { found: false, enabled: false, txt: "" };
}
async function postConfirmSuccessCue(page: import("playwright-core").Page) {
  const cues = ['text=/Success/i','text=/Confirmed/i','text=/Reserved/i','text=/Booking reference/i','text=/Reservation/i','text=/Thank you/i','text=/completed/i'];
  for (const c of cues) { if (await page.$(c)) return c; }
  return null;
}

/* -------------------- Main API handler -------------------- */

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Protect with CRON_SECRET
  const hdr = req.headers.authorization || "";
  if (hdr !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let runRef: FirebaseFirestore.DocumentReference | null = null;
  let lastUrl: string | null = null;

  try {
    // Create run doc
    runRef = await firestore.collection("golf_booking_runs").add({
      trigger: "run-now",
      started_at: new Date().toISOString(),
      user: "direct-no-login",
      target: { date: BOOKING_DATE, time: BOOKING_TIME, courseId: COURSE_ID },
      status: "in_progress"
    });

    // Launch headless Chromium
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

    // 1) Open TeeSheet DATE URL (dt INCLUDED)
    const dtUrl = buildTeeSheetDateUrl(BOOKING_DATE);
    await page.goto(dtUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    await acceptCookies(page); await dismissUpgradeModal(page); await nukeOverlays(page);

    lastUrl = page.url();
    await saveScreenDoc(runRef, { label: "teesheet_dt", url: lastUrl, title: await page.title().catch(() => "") || "", screenshot_b64: await snapAsDataUrl(page, 55) });
    await saveHtmlDoc(runRef, { label: "teesheet_dt_dom", url: lastUrl, title: await page.title().catch(() => "") || "", htmlSnippet: (await page.content().catch(() => "") || "").slice(0, 8192) });

    // Bail early if permission denied or generic error
    if (await pageLooksPermissionDenied(page) || await looksErrorPage(page)) {
      throw new Error("TeeSheet dt URL returned Permission Denied / Error without login");
    }

    // Verify day tiles exist
    const hasDayTiles =
      (await page.locator(`div.tee.available[data-teetime^="${BOOKING_DATE}"]`).count().catch(() => 0)) > 0 ||
      (await page.locator(`div.tee[data-teetime^="${BOOKING_DATE}"]`).count().catch(() => 0)) > 0;
    if (!hasDayTiles) {
      await saveScreenDoc(runRef, { label: "teesheet_dt_no_day_tiles", url: page.url(), title: await page.title().catch(() => "") || "", screenshot_b64: await snapAsDataUrl(page, 65) });
      throw new Error(`No tiles for ${BOOKING_DATE} visible on TeeSheet (dt page).`);
    }

    // 2) Find and click "Book" for 06:00
    const found = await findBookAnchorForTime(page, BOOKING_DATE, BOOKING_TIME);
    if (!found) {
      await saveScreenDoc(runRef, { label: "book_link_not_found", url: page.url(), title: await page.title().catch(() => "") || "", screenshot_b64: await snapAsDataUrl(page, 65) });
      throw new Error(`Could not find Book link for ${BOOKING_DATE} ${BOOKING_TIME}`);
    }

    // Prefer clicking the anchor to keep club-side flow
    let navigated = false;
    try {
      await found.anchor.scrollIntoViewIfNeeded().catch(() => {});
      await Promise.race([
        page.waitForURL(/\/HDIDBooking\/BookingAdd/i, { timeout: 15000 }),
        found.anchor.click({ timeout: 2500 }).then(() =>
          page.waitForURL(/\/HDIDBooking\/BookingAdd/i, { timeout: 15000 }).catch(() => {})
        ),
      ]);
      navigated = /\/HDIDBooking\/BookingAdd/i.test(page.url());
    } catch {}
    if (!navigated) {
      const href = await found.anchor.getAttribute("href").catch(() => found.href || null);
      if (href) {
        const abs = new URL(href, "https://howdidido-whs.clubv1.com").toString();
        await page.goto(abs, { waitUntil: "domcontentloaded", timeout: 30000 });
      }
    }

    await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
    await acceptCookies(page); await dismissUpgradeModal(page); await nukeOverlays(page);

    lastUrl = page.url();
    await saveScreenDoc(runRef, { label: "bookingadd_from_teesheet", url: lastUrl, title: await page.title().catch(() => "") || "", screenshot_b64: await snapAsDataUrl(page, 60) });
    await saveHtmlDoc(runRef, { label: "bookingadd_dom", url: lastUrl, title: await page.title().catch(() => "") || "", htmlSnippet: (await page.content().catch(() => "") || "").slice(0, 8192) });

    if (!/\/HDIDBooking\/BookingAdd/i.test(page.url())) {
      throw new Error(`Did not navigate to BookingAdd for ${BOOKING_DATE} ${BOOKING_TIME}`);
    }

    // 3) BookingAdd: add self, tick terms, wait & click Confirm
    const evidence: any = {};

    const addedSelector = await addSelfIfNeeded(page);
    if (addedSelector) {
      evidence.added_self_via = addedSelector;
      await saveScreenDoc(runRef, { label: "after_add_self", url: page.url(), title: await page.title().catch(() => "") || "", screenshot_b64: await snapAsDataUrl(page, 55) });
    }

    const ticked = await tickConfirmCheckboxes(page);
    if (ticked.length) {
      evidence.ticked_checkboxes = ticked;
      await saveScreenDoc(runRef, { label: "after_tick_checkboxes", url: page.url(), title: await page.title().catch(() => "") || "", screenshot_b64: await snapAsDataUrl(page, 55) });
    }

    const waitState = await waitForConfirmEnabled(page, 60_000);
    evidence.confirm_wait = waitState;

    let confirmResult = "confirm_not_found";
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
    } else if (waitState.found) {
      confirmResult = "confirm_found_but_disabled";
    }

    await saveScreenDoc(runRef, { label: "after_confirm", url: page.url(), title: await page.title().catch(() => "") || "", screenshot_b64: await snapAsDataUrl(page, 55) });
    const htmlAfter = await page.content().catch(() => "");
    await saveHtmlDoc(runRef, { label: "post_confirm_dom", url: page.url(), title: await page.title().catch(() => "") || "", htmlSnippet: (htmlAfter || "").slice(0, 8192) });
    const successCue = await postConfirmSuccessCue(page);

    await ctx.close(); await browser.close();

    await runRef.update({
      finished_at: new Date().toISOString(),
      outcome: "success",
      status: "success",
      last_url: lastUrl,
      evidence: {
        step: "direct_dt->book->bookingadd->confirm",
        confirm_result: confirmResult,
        success_cue: successCue,
        booking_evidence: evidence
      }
    });

    return res.status(200).json({ ok: true, outcome: "success", run_id: runRef.id });
  } catch (err: any) {
    const errorMsg = err?.message || "Runner error";
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
