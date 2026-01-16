
// pages/api/integrations/hdidido/runner.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import { BookingRequest, BookingRun } from "../../../../lib/hdidido/types";
import { decryptJson } from "../../../../lib/crypto";

const HOWDIDIDO_LOGIN_URL = "https://www.howdidido.com/Account/Login";

/* ======================== Notifier ======================== */
async function notify(email: string, title: string, body: string) {
  const base = process.env.APP_BASE_URL;
  if (!base) return;
  try {
    await fetch(`${base}/api/notify/emit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to_email: email, title, body, ttl_seconds: 3600 })
    });
  } catch {}
}

/* ======================== Session persistence ======================== */
const rootDoc = firestore.collection("integrations").doc("howdidido");
const sessionsCol = rootDoc.collection("sessions");

async function loadStorageState(email: string): Promise<any | null> {
  try {
    const snap = await sessionsCol.doc(email).get();
    return snap.exists ? (snap.data() as any)?.storageState || null : null;
  } catch { return null; }
}
async function saveStorageState(email: string, storageState: any) {
  const now = new Date();
  await sessionsCol.doc(email).set(
    { user_email: email, storageState, updated_at: now },
    { merge: true }
  );
}

/* ======================== Blockers handling ======================== */
async function acceptCookies(page: import("playwright-core").Page) {
  const selectors = [
    'button:has-text("OK")','a:has-text("OK")',
    'button:has-text("Accept")','button:has-text("Accept All")','button:has-text("Agree")',
    '#onetrust-accept-btn-handler','[id*="accept"]','[aria-label*="accept"]',
  ];
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) { await el.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(300); break; }
    } catch {}
  }
}
async function smashUpgradeGate(page: import("playwright-core").Page) {
  const buttonTexts = [
    "Use web version","Continue in browser","Continue to site","Continue","Open web",
    "Skip","Not now","Later","Close","Dismiss","X",
  ];
  for (const txt of buttonTexts) {
    try {
      const btn = (await page.$(`button:has-text("${txt}")`)) || (await page.$(`a:has-text("${txt}")`));
      if (btn) { await btn.click({ timeout: 1000 }).catch(() => {}); await page.waitForTimeout(300); }
    } catch {}
  }
  try {
    await page.evaluate(() => {
      const kill = (el: Element) => el.parentNode?.removeChild(el);
      const looksLikeUpgrade = (s: string) => /upgrade|update|install|app|smartbanner/i.test(s);
      const all = Array.from(document.querySelectorAll<HTMLElement>("*"));
      for (const el of all) {
        const s = window.getComputedStyle(el);
        const idc = `${el.id || ""} ${el.className?.toString() || ""}`;
        const z = parseInt(s.zIndex || "0", 10);
        const dialogish = el.getAttribute("role") === "dialog" || /modal/i.test(el.className?.toString() || "");
        const fixedish = s.position === "fixed" || s.position === "sticky" || dialogish;
        if (fixedish && (z >= 100 || looksLikeUpgrade(idc))) { try { kill(el); } catch {} }
      }
      (document.documentElement as HTMLElement).style.overflow = "auto";
      document.body.style.overflow = "auto";
      document.body.style.pointerEvents = "auto";
    });
  } catch {}
  await page.waitForTimeout(200);
}
async function dismissUpgradeModal(page: import("playwright-core").Page) {
  const selectors = [
    'button:has-text("Later")','button:has-text("Not now")','button:has-text("Continue")',
    'button:has-text("Close")','button:has-text("Dismiss")','a:has-text("Close")','a:has-text("Dismiss")',
    'button[aria-label*="close" i]','button[title*="close" i]','.modal-header .btn-close',
    '.modal .btn-close','.modal [data-bs-dismiss="modal"]','.modal .close','.modal-backdrop',
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
async function nukeOverlays(page: import("playwright-core").Page) {
  try {
    await page.evaluate(() => {
      const kill = (el: Element) => el.parentNode?.removeChild(el);
      const all = Array.from(document.querySelectorAll<HTMLElement>("*"));
      for (const el of all) {
        const s = window.getComputedStyle(el);
        const z = parseInt(s.zIndex || "0", 10);
        const dialog = el.getAttribute("role") === "dialog" || (el.className?.toString() || "").toLowerCase().includes("modal");
        if ((s.position === "fixed" || s.position === "sticky" || dialog) && z >= 100) { try { kill(el); } catch {} }
      }
      document.body.style.overflow = "auto";
    });
  } catch {}
  await page.waitForTimeout(200);
}

/* ======================== Cross-frame helpers & evidence ======================== */
function listFrameUrls(page: import("playwright-core").Page) {
  return page.frames().map(f => ({ name: f.name(), url: f.url() }));
}
async function findInFrames(page: import("playwright-core").Page, selectors: string[]) {
  for (const frame of page.frames()) {
    for (const sel of selectors) {
      try { const handle = await frame.$(sel); if (handle) return { frame, handle, selector: sel }; } catch {}
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

type EvidenceScreen = { label: string; url: string; title: string; screenshot_b64?: string; htmlSnippet?: string };
async function snap(page: import("playwright-core").Page, evidence: any, label: string, opts?: { includeHtml?: boolean }) {
  try {
    const url = page.url();
    const title = (await page.title().catch(() => "")) || "";
    let screenshot_b64: string | undefined;
    try {
      const buf = await page.screenshot({ type: "jpeg", quality: 60, fullPage: false });
      screenshot_b64 = `data:image/jpeg;base64,${buf.toString("base64")}`;
    } catch {}
    let htmlSnippet: string | undefined;
    if (opts?.includeHtml) {
      try {
        const html = await page.content();
        htmlSnippet = html.slice(0, 6144);
      } catch {}
    }
    if (!Array.isArray(evidence.screens)) evidence.screens = [];
    (evidence.screens as EvidenceScreen[]).push({ label, url, title, screenshot_b64, htmlSnippet });
  } catch {}
}

async function collectEvidence(page: import("playwright-core").Page) {
  const url = page.url();
  const title = await page.title().catch(() => "");
  let htmlSnippet: string | undefined;
  try { const html = await page.content(); htmlSnippet = html.slice(0, 8192); } catch {}
  let screenshot_b64: string | undefined;
  try { const buf = await page.screenshot({ type: "jpeg", quality: 60, fullPage: false }); screenshot_b64 = `data:image/jpeg;base64,${buf.toString("base64")}`; } catch {}
  const frames = listFrameUrls(page);
  return { url, title, htmlSnippet, screenshot_b64, frames };
}

/* ======================== Login flows ======================== */
async function tryNativeDirect(page: import("playwright-core").Page, username: string, password: string) {
  const emailCandidates = ['#Email','input[name="Email"]','input[type="email"]','input[name="email"]','input[id*="email"]','input[type="text"]'];
  const passCandidates  = ['#Password','input[name="Password"]','input[type="password"]','input[id*="password"]','input[name="password"]'];

  let emailEl: any = null; for (const sel of emailCandidates) { emailEl = await page.$(sel); if (emailEl) break; }
  if (!emailEl) return false;
  let passEl: any = null; for (const sel of passCandidates) { passEl = await page.$(sel); if (passEl) break; }
  if (!passEl) return false;

  await emailEl.fill(username); await passEl.fill(password);
  const loginButton =
    (await page.$('button:has-text("Log in")')) ||
    (await page.$('a:has-text("Log in")')) ||
    (await page.$('button[type="submit"]')) ||
    (await page.$('input[type="submit"]'));
  if (!loginButton) throw new Error('Login submit not found (native direct)');

  await loginButton.click({ timeout: 2000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  return await isLoggedIn(page);
}
async function tryNativeLogin(page: import("playwright-core").Page, username: string, password: string) {
  await page.waitForTimeout(600); await dismissUpgradeModal(page); await smashUpgradeGate(page);
  const emailFilled = await fillInFrames(page, [
    'input[type="email"]','input[name="Email"]','input[id="Email"]',
    'input[name="email"]','input[id*="email"]','input[type="text"]'
  ], username);
  if (!emailFilled) return false;
  const passFilled = await fillInFrames(page, [
    '#Password','input[type="password"]','input[name="Password"]','input[id="Password"]','input[id*="password"]','input[name="password"]'
  ], password);
  if (!passFilled) return false;
  const clicked = await clickInFrames(page, [
    'button:has-text("Log in")','a:has-text("Log in")','button[type="submit"]','input[type="submit"]'
  ]);
  if (!clicked) throw new Error("Login submit button not found (native form)");
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await dismissUpgradeModal(page); await smashUpgradeGate(page); await nukeOverlays(page);
  return await isLoggedIn(page);
}
async function tryMicrosoftLogin(page: import("playwright-core").Page, username: string, password: string) {
  await page.waitForTimeout(600); await dismissUpgradeModal(page); await smashUpgradeGate(page); await nukeOverlays(page);
  const onAzureMain = /login\.microsoftonline\.com/i.test(page.url());
  if (onAzureMain) {
    const emailInputMain = (await page.$('#i0116')) || (await page.$('input[name="loginfmt"]')) || (await page.$('input[type="email"]'));
    if (!emailInputMain) return false; await emailInputMain.fill(username);
    const nextBtnMain = (await page.$('#idSIButton9')) || (await page.$('input[type="submit"]'));
    if (!nextBtnMain) throw new Error("Microsoft login: Next button not found");
    await nextBtnMain.click();
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
    await dismissUpgradeModal(page); await smashUpgradeGate(page); await nukeOverlays(page);
    const passInputMain = (await page.$('#i0118')) || (await page.$('input[name="passwd"]')) || (await page.$('input[type="password"]'));
    if (!passInputMain) throw new Error("Microsoft login: password input not found");
    await passInputMain.fill(password);
    const signInBtnMain = (await page.$('#idSIButton9')) || (await page.$('input[type="submit"]'));
    if (!signInBtnMain) throw new Error("Microsoft login: Sign in button not found");
    await signInBtnMain.click();
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
    await dismissUpgradeModal(page); await smashUpgradeGate(page); await nukeOverlays(page);
    const stayNoMain = await page.$('#idBtn_Back'); if (stayNoMain) await stayNoMain.click().catch(() => {});
    else { const stayYesMain = await page.$('#idSIButton9'); if (stayYesMain) await stayYesMain.click().catch(() => {}); }
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await dismissUpgradeModal(page); await smashUpgradeGate(page); await nukeOverlays(page);
    return await isLoggedIn(page);
  }
  const emailOk = await fillInFrames(page, ['#i0116','input[name="loginfmt"]','input[type="email"]'], username);
  if (!emailOk) return false;
  const nextOk = await clickInFrames(page, ['#idSIButton9','input[type="submit"]','button:has-text("Next")']);
  if (!nextOk) throw new Error("Microsoft login: Next button not found");
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  await dismissUpgradeModal(page); await smashUpgradeGate(page); await nukeOverlays(page);
  const passOk = await fillInFrames(page, ['#i0118','input[name="passwd"]','input[type="password"]'], password);
  if (!passOk) throw new Error("Microsoft login: password input not found");
  const signOk = await clickInFrames(page, ['#idSIButton9','input[type="submit"]','button:has-text("Sign in")']);
  if (!signOk) throw new Error("Microsoft login: Sign in button not found");
  await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
  await dismissUpgradeModal(page); await smashUpgradeGate(page); await nukeOverlays(page);
  const stayNo = await clickInFrames(page, ['#idBtn_Back','button:has-text("No")']);
  if (!stayNo) { await clickInFrames(page, ['#idSIButton9','button:has-text("Yes")']).catch(() => {}); }
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
  await dismissUpgradeModal(page); await smashUpgradeGate(page); await nukeOverlays(page);
  return await isLoggedIn(page);
}
async function isLoggedIn(page: import("playwright-core").Page): Promise<boolean> {
  const url = page.url();
  if (/\/Account\/Login/i.test(url)) return false;
  if (/login\.microsoftonline\.com/i.test(url)) return false;
  const successCues = [
    'text=/Welcome/i','text=/Handicap/i','text=/My Account/i','text=/Sign out/i',
    'a[href*="/account"]','a[href*="/logout"]','a[href*="/dashboard"]',
  ];
  const found = await findInFrames(page, successCues);
  if (found) return true;
  const loginInputs = await findInFrames(page, ['#Email','input[name="Email"]','input[type="email"]','input[type="password"]']);
  return !loginInputs;
}

/* ======================== Task types & direct URL builders ======================== */
type BookTask = {
  type: "book";
  date: string;       // "YYYY-MM-DD"
  time: string;       // "HH:mm" (24h)
  mode?: "casual" | "competition" | string;

  // Preferred: direct BookingAdd template containing {dateTime}
  booking_add_url?: string;

  // Also supported (older direct-tee paths)
  tee_url?: string;   // supports {date}
  tee_base?: string;  // base URL (we append token & dt)
  token?: string;     // token to append with tee_base
};
type AnyTask = BookTask | { type?: string } | undefined;

function isBookTask(x: any): x is BookTask {
  return !!x && x.type === "book" && typeof x.date === "string" && typeof x.time === "string";
}

function buildBookingAddUrl(task: BookTask): { url?: string } {
  if (!task.booking_add_url) return {};
  // "YYYY-MM-DDTHH:mm", encode ":" as %3A etc.
  const dt = encodeURIComponent(`${task.date}T${task.time}`);
  let url = task.booking_add_url.replaceAll("{dateTime}", dt);
  url = url.replaceAll("{date}", encodeURIComponent(task.date))
           .replaceAll("{time}", encodeURIComponent(task.time));
  return { url };
}

function buildTeeUrl(task: BookTask, reqData: any): { url?: string; path?: "task.tee_url"|"task.base+token"|"env.base+token"|"req.base+token" } {
  const date = task.date;
  if (typeof task.tee_url === "string" && task.tee_url.trim()) {
    const tpl = task.tee_url.trim();
    const url = tpl.includes("{date}") ? tpl.replaceAll("{date}", date) : tpl;
    return { url, path: "task.tee_url" };
  }
  if (typeof task.tee_base === "string" && typeof task.token === "string" && task.tee_base) {
    const base = task.tee_base;
    const sep = base.includes("?") ? "&" : "?";
    return { url: `${base}${sep}token=${encodeURIComponent(task.token)}&dt=${encodeURIComponent(date)}`, path: "task.base+token" };
  }
  const envBase = process.env.HDIDIDO_TEE_BASE;
  const envTok = process.env.HDIDIDO_TEE_TOKEN;
  if (envBase && envTok) {
    const sep = envBase.includes("?") ? "&" : "?";
    return { url: `${envBase}${sep}token=${encodeURIComponent(envTok)}&dt=${encodeURIComponent(date)}`, path: "env.base+token" };
  }
  const reqBase = (reqData as any)?.tee_base;
  const reqTok = (reqData as any)?.tee_token || (reqData as any)?.token;
  if (typeof reqBase === "string" && typeof reqTok === "string" && reqBase) {
    const sep = reqBase.includes("?") ? "&" : "?";
    return { url: `${reqBase}${sep}token=${encodeURIComponent(reqTok)}&dt=${encodeURIComponent(date)}`, path: "req.base+token" };
  }
  return {};
}

/* ======================== Minimal time->Book click (for direct landing) ======================== */
async function clickTimeAndBook(page: import("playwright-core").Page, time: string, evidence: any) {
  await snap(page, evidence, `pre-time-click: ${time}`, { includeHtml: true });
  const variants = [time, time.replace(/^0/, "")];
  for (const v of variants) {
    try {
      const row = page.locator(`text=${v}`).first();
      const rowCount = await row.count().catch(() => 0);
      if (rowCount > 0) {
        const bookInRow = row.locator('xpath=ancestor::*[self::tr or self::*][1]').locator('text=/^\\s*Book\\s*$/i').first();
        if (await bookInRow.count().catch(() => 0)) {
          await bookInRow.click({ timeout: 2000 }).catch(()=>{});
          evidence.time_clicked = v; evidence.book_clicked = true;
          await snap(page, evidence, `after-book-click: ${v}`);
          return true;
        }
        const nearbyBook = page.locator(`text=${v}`).locator('..').locator('text=/^\\s*Book\\s*$/i').first();
        if (await nearbyBook.count().catch(() => 0)) {
          await nearbyBook.click({ timeout: 2000 }).catch(()=>{});
          evidence.time_clicked = v; evidence.book_clicked = true;
          await snap(page, evidence, `after-book-click(nearby): ${v}`);
          return true;
        }
      }
    } catch {}
  }
  for (const v of variants) {
    const timeEl = await page.$(`text=${v}`);
    if (timeEl) {
      await timeEl.click().catch(()=>{}); await page.waitForTimeout(300);
      const bookBtn =
        (await page.$('button:has-text("Book")')) ||
        (await page.$('a:has-text("Book")')) ||
        (await page.$('input[type="button"][value="Book"]'));
      if (bookBtn) {
        await bookBtn.click().catch(()=>{});
        evidence.time_clicked = v; evidence.book_clicked = true;
        await snap(page, evidence, `after-book-click(fallback): ${v}`);
        return true;
      }
    }
  }
  return false;
}

/* ======================== Main handler ======================== */
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

    const snapq = await firestore
      .collection("golf_booking_requests")
      .where("status", "==", "queued")
      .where("run_at", "<=", now)
      .orderBy("run_at", "asc")
      .limit(1)
      .get();

    if (snapq.empty) {
      return res.status(200).json({ ok: true, message: "No due jobs" });
    }

    const docRef = snapq.docs[0].ref;
    const reqData = snapq.docs[0].data() as BookingRequest & { task?: AnyTask; tee_base?: string; tee_token?: string; token?: string };

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
    let reusedSession = false;

    try {
      // Credentials
      let creds: { username?: string; password?: string } | undefined;
      if (reqData.enc_credentials_b64) { try { creds = decryptJson(reqData.enc_credentials_b64); } catch {} }
      const username = creds?.username || process.env.HDIDIDO_EMAIL || "";
      const password = creds?.password || process.env.HDIDIDO_PASSWORD || "";
      if (!username || !password) throw new Error("No HowDidiDo credentials (enc_credentials_b64 or env HDIDIDO_EMAIL/HDIDIDO_PASSWORD)");

      // Playwright bootstrap
      const { default: chromium } = await import("@sparticuz/chromium");
      const playwright = await import("playwright-core");

      const browser = await playwright.chromium.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true
      });

      const storedState = await loadStorageState(username);
      const ctx = await browser.newContext({
        storageState: storedState || undefined,
        viewport: { width: 1280, height: 800 },
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      });
      const page = await ctx.newPage();

      if (storedState) {
        await page.goto("https://www.howdidido.com/", { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        await acceptCookies(page);
        reusedSession = await isLoggedIn(page);
      }
      await snap(page, evidence, reusedSession ? "home (reused session)" : "home (pre-login)");

      if (!reusedSession) {
        await page.goto(HOWDIDIDO_LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
        await acceptCookies(page); await dismissUpgradeModal(page); await smashUpgradeGate(page); await nukeOverlays(page);

        let loggedIn = false;
        try { loggedIn = await tryNativeDirect(page, username, password); } catch {}
        if (!loggedIn) {
          await dismissUpgradeModal(page); await smashUpgradeGate(page); await nukeOverlays(page);
          try { loggedIn = await tryNativeLogin(page, username, password); } catch {}
        }
        if (!loggedIn) {
          await dismissUpgradeModal(page); await smashUpgradeGate(page); await nukeOverlays(page);
          loggedIn = await tryMicrosoftLogin(page, username, password);
        }
        if (!loggedIn) {
          evidence = { ...evidence, ...(await collectEvidence(page)) };
          throw new Error("Could not detect a successful login (modal/IdP variant blocked inputs).");
        }

        const state = await ctx.storageState();
        await saveStorageState(username, state);
      }

      await snap(page, evidence, "home (post-login)");

      // ----- Task routing
      const task = (reqData as any).task as AnyTask;
      if (task && isBookTask(task)) {
        const bookingEvidence: any = {};

        // Preferred path: direct BookingAdd
        const { url: bookingAddUrl } = buildBookingAddUrl(task);
        if (bookingAddUrl) {
          await page.goto(bookingAddUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
          await acceptCookies(page); await dismissUpgradeModal(page); await smashUpgradeGate(page);
          bookingEvidence.booking_add_url_used = bookingAddUrl;
          await snap(page, evidence, "booking-add: loaded");

          // If BookingAdd lands on the exact tee slot and requires a confirm, add it here later.
          const okBook = await clickTimeAndBook(page, task.time, bookingEvidence);
          // Some BookingAdd pages already act as the start of booking — if no time list, okBook may be false. That's fine.
          if (!okBook) {
            // Still consider "opened" a success stage; we can refine with a confirm step later if needed.
            bookingEvidence.time_click_skipped = true;
          }

          evidence.booking_evidence = bookingEvidence;
          confirmation_text = `Opened BookingAdd for ${task.date} ${task.time}`;
        } else {
          // Secondary: direct TeeSheet URL if provided
          const { url: directUrl, path } = buildTeeUrl(task, reqData);
          if (!directUrl) {
            throw new Error("No direct booking URL configured (booking_add_url or tee_url/tee_base+token/HDIDIDO_TEE_* env).");
          }
          await page.goto(directUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
          await acceptCookies(page); await dismissUpgradeModal(page); await smashUpgradeGate(page);
          bookingEvidence.tee_url_used = directUrl;
          bookingEvidence.tee_url_source = path;
          await snap(page, evidence, `tee-url: ${path}`);

          const okBook = await clickTimeAndBook(page, task.time, bookingEvidence);
          if (!okBook) throw new Error(`Could not find time ${task.time} or Book button`);

          evidence.booking_evidence = bookingEvidence;
          confirmation_text = `Booked attempt for ${task.date} ${task.time} (check booking UI for confirmation)`;
        }
      } else {
        confirmation_text = reusedSession
          ? `Session OK (reused) as ${username.replace(/(.{2}).+(@.*)/, "$1***$2")}`
          : `Login OK as ${username.replace(/(.{2}).+(@.*)/, "$1***$2")}`;
      }

      const commonEv = await collectEvidence(page);
      evidence = { ...evidence, ...commonEv };

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

    const who = reqData.requester_email;
    if (who) {
      if (outcome === "success") {
        await notify(who, "HowDidiDo runner ✅", confirmation_text || "OK");
      } else {
        await notify(who, "HowDidiDo runner failed ❌", errorMsg || "Unknown error");
      }
    }

    return res.status(200).json({ ok: true, outcome, error: errorMsg || null, note: confirmation_text || null });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
