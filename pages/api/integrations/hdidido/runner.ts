
// pages/api/integrations/hdidido/runner.ts
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Minimal hard-coded smoke path with robust login (native + MS/Azure),
 * then direct navigation to BookingAdd and a Confirm click.
 *
 * ENV REQUIRED:
 *  - CRON_SECRET           (for auth)
 *  - HDIDIDO_PASSWORD      (password for USER_EMAIL below)
 *
 * Optional:
 *  - APP_BASE_URL          (used by other flows; not required here)
 */

// --- Constants: login first URL and hard-coded BookingAdd target
const LOGIN_URL = "https://www.howdidido.com/Account/Login";
const USER_EMAIL = "ben.jones1974@hotmail.co.uk";

// 18 Jan 2026 @ 06:00 (hard-coded smoke path)
const BOOKING_ADD_URL =
  "https://howdidido-whs.clubv1.com/HDIDBooking/BookingAdd" +
  "?dateTime=2026-01-18T06%3A00" +
  "&courseId=12274" +
  "&startPoint=1" +
  "&crossOverStartPoint=0" +
  "&crossOverMinutes=0" +
  "&releasedReservation=False";

// ---------- Small utilities ----------
async function acceptCookies(page: import("playwright-core").Page) {
  const sels = [
    'button:has-text("OK")',
    'a:has-text("OK")',
    'button:has-text("Accept")',
    'button:has-text("Accept All")',
    'button:has-text("Agree")',
    '#onetrust-accept-btn-handler',
    '[id*="accept"]',
    '[aria-label*="accept"]',
  ];
  for (const s of sels) {
    try {
      const el = await page.$(s);
      if (el) {
        await el.click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(200);
        break;
      }
    } catch {}
  }
}

async function dismissUpgradeModal(page: import("playwright-core").Page) {
  const sels = [
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
    '.modal-backdrop',
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

/** Remove high-z overlays that can block clicks/typing */
async function nukeOverlays(page: import("playwright-core").Page) {
  try {
    await page.evaluate(() => {
      const kill = (el: Element) => el.parentNode?.removeChild(el);
      const all = Array.from(document.querySelectorAll<HTMLElement>("*"));
      for (const el of all) {
        const s = window.getComputedStyle(el);
        const z = parseInt(s.zIndex || "0", 10);
        const isDialog = el.getAttribute("role") === "dialog" || (el.className || "").toLowerCase().includes("modal");
        if ((s.position === "fixed" || s.position === "sticky" || isDialog) && z >= 100) {
          try { kill(el); } catch {}
        }
      }
      document.documentElement.style.overflow = "auto";
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
  const url = page.url();
  if (isLoginUrl(url)) return false;
  const cues = [
    'text=/Welcome/i',
    'text=/Handicap/i',
    'text=/My Account/i',
    'text=/Sign out/i',
    'a[href*="/account"]',
    'a[href*="/logout"]',
    'a[href*="/dashboard"]',
  ];
  for (const c of cues) {
    if (await page.$(c)) return true;
  }
  return false;
}

/** Find first matching selector across all frames */
async function findInFrames(page: import("playwright-core").Page, selectors: string[]) {
  for (const frame of page.frames()) {
    for (const sel of selectors) {
      try {
        const h = await frame.$(sel);
        if (h) return { frame, handle: h, selector: sel };
      } catch {}
    }
  }
  return null;
}

/** Wait up to ms for any of selectors to appear in any frame */
async function waitForAnyInFrames(
  page: import("playwright-core").Page,
  selectors: string[],
  ms = 8000,
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

// ---------- Login variants ----------
async function loginNative(page: import("playwright-core").Page, email: string, password: string) {
  const emailSels = ['#Email', 'input[name="Email"]', 'input[type="email"]', 'input[name="email"]', 'input[id*="email"]', 'input[type="text"]'];
  const passSels  = ['#Password', 'input[name="Password"]', 'input[type="password"]', 'input[id*="password"]', 'input[name="password"]'];
  const submitSels = [
    'button[type="submit"]',
    'button:has-text("Log in")',
    'button:has-text("Sign in")',
    'a:has-text("Log in")',
    'input[type="submit"]',
  ];

  const emailFound = await waitForAnyInFrames(page, emailSels, 12000, 300);
  if (!emailFound) return false;

  await emailFound.handle.fill(email);
  const passFound = await waitForAnyInFrames(page, passSels, 6000, 250);
  if (!passFound) return false;
  await passFound.handle.fill(password);

  const submitFound = await waitForAnyInFrames(page, submitSels, 4000, 200);
  if (!submitFound) throw new Error("Login submit button not found (native)");
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

  const stayNo = await page.$('#idBtn_Back');
  if (stayNo) { await stayNo.click().catch(() => {}); }
  else {
    const stayYes = await page.$('#idSIButton9');
    if (stayYes) await stayYes.click().catch(() => {});
  }

  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  return await isLoggedIn(page);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Protect with CRON_SECRET
  const hdr = req.headers.authorization || "";
  if (hdr !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { default: chromium } = await import("@sparticuz/chromium");
    const playwright = await import("playwright-core");

    const browser = await playwright.chromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    });
    const page = await ctx.newPage();

    // --- Ensure password provided
    const password = process.env.HDIDIDO_PASSWORD || "";
    if (!password) throw new Error("HDIDIDO_PASSWORD env var not set");

    // --- 1) Go to the FIRST login URL (normal login flow)
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await acceptCookies(page);
    await dismissUpgradeModal(page);
    await nukeOverlays(page);

    let loggedIn = false;
    if (/login\.microsoftonline\.com/i.test(page.url())) {
      loggedIn = await loginMicrosoft(page, USER_EMAIL, password);
    } else {
      try { loggedIn = await loginNative(page, USER_EMAIL, password); } catch {}
      if (!loggedIn) {
        loggedIn = await loginMicrosoft(page, USER_EMAIL, password);
      }
    }

    if (!loggedIn) {
      let screenshot_b64: string | undefined;
      try {
        const buf = await page.screenshot({ type: "jpeg", quality: 70 });
        screenshot_b64 = `data:image/jpeg;base64,${buf.toString("base64")}`;
      } catch {}
      await ctx.close();
      await browser.close();
      return res.status(200).json({
        ok: true,
        outcome: "failed",
        error: "Login not detected (email/password inputs blocked or variant changed).",
        evidence: { url: page.url(), screenshot_b64 }
      });
    }

    // Snapshot after login
    let loginShot: string | undefined;
    try {
      const buf = await page.screenshot({ type: "jpeg", quality: 70 });
      loginShot = `data:image/jpeg;base64,${buf.toString("base64")}`;
    } catch {}

    // --- 2) Navigate to your hard-coded BookingAdd URL
    await page.goto(BOOKING_ADD_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await acceptCookies(page);
    await dismissUpgradeModal(page);

    // Snapshot before confirm (for debugging)
    let bookingShotBefore: string | undefined;
    try {
      const buf = await page.screenshot({ type: "jpeg", quality: 70 });
      bookingShotBefore = `data:image/jpeg;base64,${buf.toString("base64")}`;
    } catch {}

    // --- 3) Click Confirm
    // ID from your markup: #btn-confirm-and-pay (text "Confirm" in #btn-confirm-and-pay-text)
    let confirmResult = "confirm_not_found";
    try {
      const confirmSel = '#btn-confirm-and-pay';
      const confirmTextSel = '#btn-confirm-and-pay-text';
      // Make sure any overlays are cleared before waiting/clicking
      await dismissUpgradeModal(page);
      await nukeOverlays(page);

      // Wait up to 12s for the button to appear
      const btn = await page.waitForSelector(confirmSel, { timeout: 12000, state: "visible" }).catch(() => null);
      if (btn) {
        await btn.scrollIntoViewIfNeeded().catch(() => {});
        // Optional: ensure text says Confirm
        const spanText = await page.$(confirmTextSel).then(h => h?.textContent() ?? "").catch(() => "");
        // Click it
        await btn.click({ timeout: 2000 }).catch(() => {});
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await dismissUpgradeModal(page);

        // Heuristics to infer success:
        // - button disappears or becomes disabled
        // - text changes from "Confirm"
        // - presence of common success keywords
        const stillThere = await page.$(confirmSel);
        const disabled = await page.$(`${confirmSel}[disabled]`);
        const textNow = await page.$(confirmTextSel).then(h => h?.textContent() ?? "").catch(() => "");
        const successCue =
          (await page.$('text=/Success|Confirmed|Reserved|Booking reference|Reservation/i')) ||
          (await page.$('text=/Thank you|completed/i'));

        if (!stillThere || disabled || (spanText?.trim() || "").toLowerCase() !== (textNow?.trim() || "").toLowerCase() || successCue) {
          confirmResult = "confirm_clicked_success";
        } else {
          confirmResult = "confirm_clicked_but_unclear";
        }
      } else {
        confirmResult = "confirm_not_found";
      }
    } catch (e: any) {
      confirmResult = `confirm_click_error: ${e?.message || "unknown"}`;
    }

    // Snapshot after confirm (for debugging)
    let bookingShotAfter: string | undefined;
    try {
      const buf = await page.screenshot({ type: "jpeg", quality: 70 });
      bookingShotAfter = `data:image/jpeg;base64,${buf.toString("base64")}`;
    } catch {}

    await ctx.close();
    await browser.close();

    return res.status(200).json({
      ok: true,
      outcome: "success",
      user: USER_EMAIL,
      step: "login-then-bookingadd-confirm",
      bookingUrl: BOOKING_ADD_URL,
      confirm_result: confirmResult,
      screenshots: {
        post_login: loginShot,
        booking_before_confirm: bookingShotBefore,
        booking_after_confirm: bookingShotAfter
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      outcome: "failed",
      error: err?.message || "Runner error"
    });
  }
}
