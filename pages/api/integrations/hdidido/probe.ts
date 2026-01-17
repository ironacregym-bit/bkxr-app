
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
  return `https://howdidido-whs.clubv1.com/HDIDBooking/TeeSheet`
    + `?courseId=${COURSE_ID}`
    + `&token=${encodeURIComponent(token)}`
    + `&dt=${encodeURIComponent(PROBE_DATE)}`;
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

/** Find the "Book" anchor for a given date/time tile. */
async function findBookAnchorForTime(page: Page, dateYMD: string, timeHM: string) {
  const dateTime = `${dateYMD} ${timeHM}`;
  const exact = page.locator(`div.tee.available[data-teetime="${dateTime}"] .controls a[data-book="1"]`).first();
  if (await exact.count().catch(()=>0)) return exact;

  const id = `${dateYMD}-${timeHM.replace(":", "-")}`;
  const byId = page.locator(`div.tee.available#${id} .controls a[data-book="1"]`).first();
  if (await byId.count().catch(()=>0)) return byId;

  const row = page.locator('div.tee.available').filter({ has: page.locator(`.time >> text=${timeHM.replace(/^0/,"")}`) }).first();
  if (await row.count().catch(()=>0)) {
    const a = row.locator('.controls a[data-book="1"]').first();
    if (await a.count().catch(()=>0)) return a;
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
      if (!loggedIn) {
        // We’ll still try to open the date URL to see if the site allows it (most likely it will redirect)
      }
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

    // 2) Try clicking 06:00 → Book
    let afterClickUrl: string | null = null;
    let atBookingAdd: boolean | null = null;
    let bookAnchorHref: string | null = null;

    const anchor = await findBookAnchorForTime(page, PROBE_DATE, "06:00");
    if (anchor) {
      bookAnchorHref = await anchor.getAttribute("href").catch(() => null);
      try {
        await anchor.scrollIntoViewIfNeeded().catch(()=>{});
        await Promise.race([
          page.waitForURL(/\/HDIDBooking\/BookingAdd/i, { timeout: 12_000 }),
          anchor.click({ timeout: 2_000 }).then(() =>
            page.waitForURL(/\/HDIDBooking\/BookingAdd/i, { timeout: 12_000 }).catch(()=>{})
          ),
        ]).catch(()=>{});
      } catch {}

      await page.waitForTimeout(800);
      afterClickUrl = page.url();
      atBookingAdd = /\/HDIDBooking\/BookingAdd/i.test(afterClickUrl);
    } else {
      await runRef.collection("artifacts").add({
        type: "note",
        label: "book_anchor",
        message: "Book link not found for 06:00",
        created_at: new Date().toISOString(),
      });
    }

    // AFTER click
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
