
// pages/api/integrations/hdidido/probe.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import type { Page } from "playwright-core";

/**
 * Minimal diagnostic probe (Option B + click build-up)
 * - Opens ONE exact URL (TeeSheet date with token)
 * - Default: also attempts the 06:00 → Book click (can be disabled via ?click=0)
 * - Captures resulting URL(s), status, title, body sample
 * - Saves bounded screenshots & capped HTML in Firestore
 *
 * ENV REQUIRED:
 *  - CRON_SECRET
 *  - HDIDIDO_TEE_TOKEN
 */

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

/** Your DOM: find the "Book" anchor for a given date/time tile. */
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Auth
  if ((req.headers.authorization || "") !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Defaults to clicking after open unless query click=0
  const clickParam = Array.isArray(req.query.click) ? req.query.click[0] : req.query.click;
  const doClick = clickParam === "0" ? false : true;

  let runRef: FirebaseFirestore.DocumentReference | null = null;

  try {
    const requestedUrl = buildProbeUrl();

    // Create probe record
    runRef = await firestore.collection("golf_booking_probes").add({
      started_at: new Date().toISOString(),
      requested_url: requestedUrl,
      course_id: COURSE_ID,
      dt: PROBE_DATE,
      will_click: doClick,
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

    // 1) Open the date TeeSheet URL (no retries)
    const response = await page.goto(requestedUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    await page.waitForTimeout(1500); // settle redirects if any
    await acceptCookies(page);

    const resultingUrl = page.url();
    const httpStatus = response?.status() ?? null;
    const httpStatusText = response?.statusText?.() ?? null;
    const pageTitle = await page.title().catch(() => null);
    const bodyTextSample = await page.evaluate(
      () => (document.body ? document.body.innerText.slice(0, 2000) : "")
    );

    // Screenshot BEFORE any click
    const beforeShot = await boundedShot(page);
    await runRef.collection("artifacts").add({
      type: "screenshot",
      label: "viewport_initial",
      base64: beforeShot.base64 || undefined,
      quality: beforeShot.quality || undefined,
      note: beforeShot.base64 ? undefined : beforeShot.note || "screenshot skipped",
      created_at: new Date().toISOString(),
    });

    // Initial HTML (capped)
    const htmlInitial = await page.content().catch(() => "");
    await runRef.collection("artifacts").add({
      type: "html",
      label: "initial_dom",
      content: (htmlInitial || "").slice(0, 200_000),
      created_at: new Date().toISOString(),
    });

    // Update top-level probe metadata
    await runRef.update({
      resulting_url: resultingUrl,
      http_status: httpStatus,
      http_status_text: httpStatusText,
      page_title: pageTitle,
      body_text_sample: bodyTextSample,
    });

    // 2) Optionally try clicking 06:00 → Book
    let afterClickUrl: string | null = null;
    let atBookingAdd: boolean | null = null;
    let bookAnchorHref: string | null = null;

    if (doClick) {
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

        // Screenshot AFTER click
        const afterShot = await boundedShot(page);
        await runRef.collection("artifacts").add({
          type: "screenshot",
          label: "viewport_after_click",
          base64: afterShot.base64 || undefined,
          quality: afterShot.quality || undefined,
          note: afterShot.base64 ? undefined : afterShot.note || "screenshot skipped",
          created_at: new Date().toISOString(),
        });

        // HTML AFTER click (capped)
        const htmlAfter = await page.content().catch(() => "");
        await runRef.collection("artifacts").add({
          type: "html",
          label: "after_click_dom",
          content: (htmlAfter || "").slice(0, 200_000),
          created_at: new Date().toISOString(),
        });
      } else {
        // No anchor found: record this outcome
        await runRef.collection("artifacts").add({
          type: "note",
          label: "book_anchor",
          message: "Book link not found for 06:00",
          created_at: new Date().toISOString(),
        });
      }
    }

    await browser.close();

    // Finalise probe doc
    await runRef.update({
      finished_at: new Date().toISOString(),
      status: "complete",
      click_attempted: doClick,
      book_anchor_href: bookAnchorHref || null,
      after_click_url: afterClickUrl || null,
      at_booking_add: atBookingAdd,
    });

    // API response
    return res.status(200).json({
      ok: true,
      probe_id: runRef.id,
      requested_url: requestedUrl,
      resulting_url: resultingUrl,
      http_status: httpStatus,
      page_title: pageTitle,
      click_attempted: doClick,
      after_click_url: afterClickUrl,
      at_booking_add: atBookingAdd,
    });

  } catch (err: any) {
    if (runRef) {
      try {
        await runRef.update({
          finished_at: new Date().toISOString(),
          status: "error",
          error: err?.message || "Probe failed",
        });
      } catch {}
    }
    return res.status(500).json({
      ok: false,
      error: err?.message || "Probe failed",
      probe_id: runRef ? runRef.id : null,
    });
  }
}
