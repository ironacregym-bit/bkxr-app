
// pages/api/integrations/hdidido/probe.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import type { Page } from "playwright-core";

const LOGIN_URL = "https://www.howdidido.com/Account/Login";

// Target for this probe
const PROBE_DATE = "2026-01-18"; // YYYY-MM-DD
const COURSE_ID = 12274;         // Course to test

function buildProbeUrl(): string {
  const token = process.env.HDIDIDO_TEE_TOKEN;
  if (!token) throw new Error("HDIDIDO_TEE_TOKEN not set");
  // IMPORTANT: use '&' not '&amp;' in code
  return (
    `https://howdidido-whs.clubv1.com/HDIDBooking/TeeSheet` +
    `?courseId=${COURSE_ID}` +
    `&token=${encodeURIComponent(token)}` +
    `&dt=${encodeURIComponent(PROBE_DATE)}`
  );
}

async function acceptCookies(page: Page) {
  const sels = [
    'button:has-text("OK")','a:has-text("OK")',
    'button:has-text("Accept")','button:has-text("Accept All")','button:has-text("Agree")',
    '#onetrust-accept-btn-handler','[id*="accept"]','[aria-label*="accept"]',
  ];
  for (const s of sels) {
    try {
      const el = await page.$(s);
      if (el) { await el.click({ timeout: 1000 }).catch(()=>{}); await page.waitForTimeout(150); break; }
    } catch {}
  }
}

/** Firestore-safe screenshot: viewport-only, reduce quality until <= limit. */
async function boundedShot(page: Page, limit = 900_000) {
  for (const q of [45, 40, 35, 30, 25, 20, 15]) {
    const buf = await page.screenshot({ fullPage: false, type: "jpeg", quality: q });
    const b64 = (buf as Buffer).toString("base64");
    if (b64.length <= limit) return { base64: b64, quality: q };
  }
  return { base64: null as string | null, quality: null as number | null, note: "screenshot size remained > limit, skipped" };
}

/** STRICT tee-tile “Book” matching that only returns anchors pointing to BookingAdd */
async function findBookAnchorForTime(
  page: Page,
  dateYMD: string,
  timeHM: string
): Promise<null | { anchor: ReturnType<Page["locator"]>; scope: string; reason: string }> {
  const dateTime = `${dateYMD} ${timeHM}`;
  const tileId = `${dateYMD}-${timeHM.replace(":", "-")}`;

  // 1) Strict: within the exact tee tile by data-teetime; href must target BookingAdd
  const strict = page
    .locator(
      `div.tee.available[data-teetime="${dateTime}"] .controls a[data-book="1"][href*="HDIDBooking/BookingAdd"]`
    )
    .first();
  if (await strict.count().catch(() => 0)) {
    return { anchor: strict, scope: `tile[data-teetime="${dateTime}"]`, reason: "strict" };
  }

  // 2) Strict by tile id
  const strictById = page
    .locator(
      `div.tee.available#${tileId} .controls a[data-book="1"][href*="HDIDBooking/BookingAdd"]`
    )
    .first();
  if (await strictById.count().catch(() => 0)) {
    return { anchor: strictById, scope: `tile#${tileId}`, reason: "strictById" };
  }

  // 3) Soft within tile by data-teetime; verify href contains BookingAdd before returning
  const soft = page
    .locator(`div.tee.available[data-teetime="${dateTime}"] .controls a[data-book="1"]`)
    .first();
  if (await soft.count().catch(() => 0)) {
    const href = await soft.getAttribute("href").catch(() => null);
    if (href && /HDIDBooking\/BookingAdd/i.test(href)) {
      return { anchor: soft, scope: `tile[data-teetime="${dateTime}"]`, reason: "soft+href-ok" };
    } else {
      // Explicitly return a mismatch so we can log why we refused to click
      return { anchor: null as any, scope: `tile[data-teetime="${dateTime}"]`, reason: `soft+href-mismatch:${href || "null"}` };
    }
  }

  // 4) Soft by id; verify href before returning
  const softById = page
    .locator(`div.tee.available#${tileId} .controls a[data-book="1"]`)
    .first();
  if (await softById.count().catch(() => 0)) {
    const href = await softById.getAttribute("href").catch(() => null);
    if (href && /HDIDBooking\/BookingAdd/i.test(href)) {
      return { anchor: softById, scope: `tile#${tileId}`, reason: "softById+href-ok" };
    } else {
      return { anchor: null as any, scope: `tile#${tileId}`, reason: `softById+href-mismatch:${href || "null"}` };
    }
  }

  return null;
}

// -------------------- Login helpers (native + Microsoft) --------------------

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
function isLoginUrl(url: string) { return /\/Account\/Login/i.test(url) || /login\.microsoftonline\.com/i.test(url); }
async function isLoggedIn(page: Page) {
  const url = page.url(); if (isLoginUrl(url)) return false;
  const cues = [ 'text=/My Account/i','text=/Sign out/i','a[href*="/logout"]','a[href*="/account"]' ];
  for (const c of cues) { if (await page.$(c)) return true; }
  return false;
}
async function waitForAnyInFrames(page: Page, selectors: string[], ms = 12000, step = 250) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    for (const frame of page.frames()) {
      for (const sel of selectors) {
        const h = await frame.$(sel).catch(()=>null);
        if (h) return { frame, handle: h, selector: sel };
      }
    }
    await page.waitForTimeout(step);
  }
  return null;
}
async function loginNative(page: Page, email: string, password: string) {
  const emailSels = ['#Email','input[name="Email"]','input[type="email"]','input[name="email"]','input[id*="email"]','input[type="text"]'];
  const passSels  = ['#Password','input[name="Password"]','input[type="password"]','input[id*="password"]','input[name="password"]'];
  const submitSels= ['button[type="submit"]','button:has-text("Log in")','button:has-text("Sign in")','a:has-text("Log in")','input[type="submit"]'];

  const emailFound = await waitForAnyInFrames(page, emailSels); if (!emailFound) return false;
  await emailFound.handle.fill(email);

  const passFound = await waitForAnyInFrames(page, passSels, 8000); if (!passFound) return false;
  await passFound.handle.fill(password);

  const submitFound= await waitForAnyInFrames(page, submitSels, 6000); if (!submitFound) return false;
  await submitFound.handle.click().catch(()=>{});

  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(()=>{});
  return await isLoggedIn(page);
}
async function loginMicrosoft(page: Page, email: string, password: string) {
  const emailSel = (await page.$('#i0116')) || (await page.$('input[name="loginfmt"]')) || (await page.$('input[type="email"]'));
  if (!emailSel) return false;
  await emailSel.fill(email);

  const nextBtn = (await page.$('#idSIButton9')) || (await page.$('button:has-text("Next")')) || (await page.$('input[type="submit"]'));
  if (nextBtn) await nextBtn.click().catch(()=>{});

  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(()=>{});

  const passSel = (await page.$('#i0118')) || (await page.$('input[name="passwd"]')) || (await page.$('input[type="password"]'));
  if (!passSel) return false;
  await passSel.fill(password);

  const signBtn = (await page.$('#idSIButton9')) || (await page.$('button:has-text("Sign in")')) || (await page.$('input[type="submit"]'));
  if (signBtn) await signBtn.click().catch(()=>{});

  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(()=>{});
  const stayNo = await page.$('#idBtn_Back'); if (stayNo) await stayNo.click().catch(()=>{});
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(()=>{});
  return await isLoggedIn(page);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth
  if ((req.headers.authorization || "") !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Optional: ?login=1 to authenticate first
  const loginParam = Array.isArray(req.query.login) ? req.query.login[0] : req.query.login;
  const doLogin = loginParam === "1";

  let runRef: FirebaseFirestore.DocumentReference | null = null;

  try {
    const requestedUrl = buildProbeUrl();

    // Create probe record
    runRef = await firestore.collection("golf_booking_probes").add({
      started_at: new Date().toISOString(),
      requested_url: requestedUrl,
      course_id: COURSE_ID,
      dt: PROBE_DATE,
      will_login: doLogin,
      will_click: true, // we try click in this probe
      status: "in_progress"
    });

    // Launch Playwright
    const { default: chromium } = await import("@sparticuz/chromium");
    const playwright = await import("playwright-core");

    const browser = await playwright.chromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1200, height: 700 }, // keep size modest
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    });

    const page: Page = await context.newPage();

    // Optionally login first
    if (doLogin) {
      const email = getEmail();
      const password = getPassword();

      await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
      await acceptCookies(page);

      let loggedIn = false;
      try { loggedIn = await loginNative(page, email, password); } catch {}
      if (!loggedIn) { loggedIn = await loginMicrosoft(page, email, password); }

      await runRef.update({ login_result: loggedIn ? "success" : "failed", login_url_after: page.url() });
      // Even if login fails, continue to try the date URL to capture evidence (likely a redirect to login)
    }

    // 1) Open the date TeeSheet URL (no retries)
    const response = await page.goto(requestedUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    await page.waitForTimeout(1500); // settle any client redirects
    await acceptCookies(page);

    const resultingUrl = page.url();
    const httpStatus = response?.status() ?? null;
    const httpStatusText = response?.statusText?.() ?? null;
    const pageTitle = await page.title().catch(() => null);
    const bodyTextSample = await page.evaluate(
      () => (document.body ? document.body.innerText.slice(0, 2000) : "")
    );

    // BEFORE click
    const beforeShot = await boundedShot(page);
    await runRef.collection("artifacts").add({
      type: "screenshot",
      label: "viewport_initial",
      base64: beforeShot.base64 || undefined,
      quality: beforeShot.quality || undefined,
      note: beforeShot.base64 ? undefined : beforeShot.note || "screenshot skipped",
      created_at: new Date().toISOString(),
    });
    const htmlInitial = await page.content().catch(() => "");
    await runRef.collection("artifacts").add({
      type: "html",
      label: "initial_dom",
      content: (htmlInitial || "").slice(0, 200_000),
      created_at: new Date().toISOString(),
    });

    await runRef.update({
      resulting_url: resultingUrl,
      http_status: httpStatus,
      http_status_text: httpStatusText,
      page_title: pageTitle,
      body_text_sample: bodyTextSample,
    });

    // 2) STRICT: Click the 06:00 tile's "Book" → BookingAdd (never global Booking)
    let afterClickUrl: string | null = null;
    let atBookingAdd: boolean | null = null;
    let bookAnchorHref: string | null = null;

    const found = await findBookAnchorForTime(page, PROBE_DATE, "06:00");

    if (!found || !found.anchor) {
      // Capture why we didn't click (not found, or href mismatch in soft paths)
      await runRef.collection("artifacts").add({
        type: "note",
        label: "book_anchor",
        scope: found?.scope || "unknown",
        message: found?.reason || "no anchor found",
        created_at: new Date().toISOString(),
      });
    } else {
      // Grab tile HTML (prefer data-teetime; fallback id)
      const dateTime = `${PROBE_DATE} 06:00`;
      const tileHtmlByData = await page
        .locator(`div.tee.available[data-teetime="${dateTime}"]`)
        .first()
        .evaluate((el) => (el as HTMLElement).outerHTML)
        .catch(() => null);
      const tileHtml =
        tileHtmlByData ||
        (await page
          .locator(`div.tee.available#${PROBE_DATE}-${"06:00".replace(":", "-")}`)
          .first()
          .evaluate((el) => (el as HTMLElement).outerHTML)
          .catch(() => null));

      // Anchor metadata
      const href = await found.anchor.getAttribute("href").catch(() => null);
      const text = await found.anchor.textContent().catch(() => null);

      // Log diagnostics
      await runRef.collection("artifacts").add({
        type: "html",
        label: "tile_scope_html",
        content: (tileHtml || "").slice(0, 20000),
        created_at: new Date().toISOString(),
      });
      await runRef.collection("artifacts").add({
        type: "note",
        label: "book_anchor_meta",
        scope: found.scope,
        reason: found.reason,
        href,
        text: (text || "").trim() || null,
        created_at: new Date().toISOString(),
      });

      // Safety: assert we only click BookingAdd href
      if (!href || !/HDIDBooking\/BookingAdd/i.test(href)) {
        throw new Error(`Refusing to click non-BookingAdd href: ${href || "null"}`);
      }

      // Record requested URL BEFORE the click
      bookAnchorHref = href;
      await runRef.update({ bookingadd_requested_url: bookAnchorHref });

      // Click → expect URL to match BookingAdd
      try {
        await found.anchor.scrollIntoViewIfNeeded().catch(() => {});
        await Promise.race([
          page.waitForURL(/\/HDIDBooking\/BookingAdd/i, { timeout: 15000 }),
          found.anchor.click({ timeout: 2500 }).then(() =>
            page
              .waitForURL(/\/HDIDBooking\/BookingAdd/i, { timeout: 15000 })
              .catch(() => {})
          ),
        ]).catch(() => {});
      } catch {}

      await page.waitForTimeout(800);
      afterClickUrl = page.url();
      atBookingAdd = /\/HDIDBooking\/BookingAdd/i.test(afterClickUrl);

      // Persist resulting URL after the click
      await runRef.update({ bookingadd_resulting_url: afterClickUrl });

      // AFTER click evidence
      const afterShot = await boundedShot(page);
      await runRef.collection("artifacts").add({
        type: "screenshot",
        label: "viewport_after_click",
        base64: afterShot.base64 || undefined,
        quality: afterShot.quality || undefined,
        note: afterShot.base64 ? undefined : afterShot.note || "screenshot skipped",
        created_at: new Date().toISOString(),
      });
      const htmlAfter = await page.content().catch(() => "");
      await runRef.collection("artifacts").add({
        type: "html",
        label: "after_click_dom",
        content: (htmlAfter || "").slice(0, 200_000),
        created_at: new Date().toISOString(),
      });

      if (!atBookingAdd) {
        // If we strictly clicked a BookingAdd href but didn’t land there, surface this clearly
        throw new Error(`After clicking correct tile anchor, did not land on BookingAdd. Now at: ${afterClickUrl}`);
      }
    }

    await browser.close();

    // Finalise
    await runRef.update({
      finished_at: new Date().toISOString(),
      status: "complete",
      book_anchor_href: bookAnchorHref || null,
      after_click_url: afterClickUrl || null,
      at_booking_add: atBookingAdd,
    });

    return res.status(200).json({
      ok: true,
      probe_id: runRef.id,
      requested_url: requestedUrl,
      resulting_url: resultingUrl,
      http_status: httpStatus,
      page_title: pageTitle,
      login_attempted: doLogin,
      after_click_url: afterClickUrl,
      at_booking_add: atBookingAdd,
    });

  } catch (err: any) {
    if (runRef) {
      await runRef.update({
        finished_at: new Date().toISOString(),
        status: "error",
        error: err?.message || "Probe failed",
      }).catch(()=>{});
    }
    return res.status(500).json({
      ok: false,
      error: err?.message || "Probe failed",
      probe_id: runRef ? runRef.id : null,
    });
  }
}
