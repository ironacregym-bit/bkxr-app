
// pages/api/integrations/hdidido/probe.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import type { Page } from "playwright-core";

/**
 * Minimal diagnostic probe (Option B - Firestore only, bounded screenshot)
 * - Opens ONE URL (TeeSheet date with token)
 * - No login, no clicks, no retries
 * - Captures resulting URL, status, title, body sample
 * - Saves a small (bounded) screenshot & capped HTML into Firestore subcollection
 *
 * ENV REQUIRED:
 *  - CRON_SECRET
 *  - HDIDIDO_TEE_TOKEN
 *
 * Notes:
 *  - We keep viewport modest and JPEG quality reduced.
 *  - We re-encode at lower quality if base64 > ~900k chars.
 *  - If still too large, we store a note and skip the screenshot.
 */

// Hard-coded target for this probe (adjust if needed)
const PROBE_DATE = "2026-01-18"; // YYYY-MM-DD
const COURSE_ID = 12274;         // date list page for specific course

function buildProbeUrl(): string {
  const token = process.env.HDIDIDO_TEE_TOKEN;
  if (!token) throw new Error("HDIDIDO_TEE_TOKEN not set");
  return `https://howdidido-whs.clubv1.com/HDIDBooking/TeeSheet`
    + `?courseId=${COURSE_ID}`
    + `&token=${encodeURIComponent(token)}`
    + `&dt=${encodeURIComponent(PROBE_DATE)}`;
}

/** Capture a Firestore-safe (bounded) screenshot.
 * Strategy:
 *  - viewport-only (no fullPage)
 *  - start quality=45, reduce by 5 until <= maxBase64 or quality floor
 *  - if still too large, return null with note
 */
async function captureBoundedScreenshot(page: Page, maxBase64Chars = 900_000) {
  const qualities = [45, 40, 35, 30, 25, 20];
  for (const q of qualities) {
    const buf = await page.screenshot({
      fullPage: false,   // viewport only to minimize size
      type: "jpeg",
      quality: q,
    });
    const b64 = (buf as Buffer).toString("base64");
    if (b64.length <= maxBase64Chars) {
      return { base64: b64, quality: q };
    }
  }
  return { base64: null as string | null, quality: null as number | null, note: "screenshot size remained > limit, skipped" };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Server-side auth
  if ((req.headers.authorization || "") !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let runRef: FirebaseFirestore.DocumentReference | null = null;

  try {
    const requestedUrl = buildProbeUrl();

    // Create a probe record
    runRef = await firestore.collection("golf_booking_probes").add({
      started_at: new Date().toISOString(),
      requested_url: requestedUrl,
      course_id: COURSE_ID,
      dt: PROBE_DATE,
      status: "in_progress"
    });

    // Boot Playwright
    const { default: chromium } = await import("@sparticuz/chromium");
    const playwright = await import("playwright-core");

    const browser = await playwright.chromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1200, height: 700 }, // modest viewport to help keep screenshot small
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    });

    const page: Page = await context.newPage();

    // Navigate to the requested URL (no retries, no other URLs)
    const response = await page.goto(requestedUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Give client-side redirects a moment if any
    await page.waitForTimeout(1500);

    const resultingUrl = page.url();
    const httpStatus = response?.status() ?? null;
    const httpStatusText = response?.statusText?.() ?? null;
    const pageTitle = await page.title().catch(() => null);

    // Body sample for quick debugging (avoid massive doc size)
    const bodyTextSample = await page.evaluate(
      () => (document.body ? document.body.innerText.slice(0, 2000) : "")
    );

    // Capture bounded screenshot (viewport only)
    const boundedShot = await captureBoundedScreenshot(page);

    // Cap HTML length to avoid exceeding Firestore doc size
    const html = await page.content().catch(() => "");
    const htmlCapped = (html || "").slice(0, 200_000); // ~200k chars

    await browser.close();

    // Update main doc with top-level metadata
    await runRef.update({
      finished_at: new Date().toISOString(),
      status: "complete",
      resulting_url: resultingUrl,
      http_status: httpStatus,
      http_status_text: httpStatusText,
      page_title: pageTitle,
      body_text_sample: bodyTextSample,
    });

    // Store bounded screenshot (if small enough) in a sub-doc
    if (boundedShot.base64) {
      await runRef.collection("artifacts").add({
        type: "screenshot",
        variant: "viewport_bounded",
        mime: "image/jpeg",
        quality: boundedShot.quality,
        base64: boundedShot.base64, // safe size
        created_at: new Date().toISOString(),
      });
    } else {
      await runRef.collection("artifacts").add({
        type: "screenshot",
        note: boundedShot.note || "screenshot skipped",
        created_at: new Date().toISOString(),
      });
    }

    // Store capped HTML
    await runRef.collection("artifacts").add({
      type: "html",
      created_at: new Date().toISOString(),
      content: htmlCapped,
    });

    // API response
    return res.status(200).json({
      ok: true,
      probe_id: runRef.id,
      requested_url: requestedUrl,
      resulting_url: resultingUrl,
      http_status: httpStatus,
      page_title: pageTitle,
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
