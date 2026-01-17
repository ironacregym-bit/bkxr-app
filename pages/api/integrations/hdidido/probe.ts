
// pages/api/integrations/hdidido/probe.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import type { Page } from "playwright-core";

/**
 * Diagnostic probe
 * - Visit ONE explicit URL (no login, no clicks)
 * - Capture exactly what loads
 * - Save screenshot + HTML + metadata to Firestore
 *
 * ENV REQUIRED:
 *  - CRON_SECRET
 *  - HDIDIDO_TEE_TOKEN
 */

const PROBE_DATE = "2026-01-18";
const COURSE_ID = 12274;

/** Build the EXACT URL we want to test */
function buildProbeUrl() {
  const token = process.env.HDIDIDO_TEE_TOKEN;
  if (!token) throw new Error("HDIDIDO_TEE_TOKEN not set");

  return `https://howdidido-whs.clubv1.com/HDIDBooking/TeeSheet` +
         `?courseId=${COURSE_ID}` +
         `&token=${encodeURIComponent(token)}` +
         `&dt=${encodeURIComponent(PROBE_DATE)}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if ((req.headers.authorization || "") !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let runRef: FirebaseFirestore.DocumentReference | null = null;

  try {
    const url = buildProbeUrl();

    // Create Firestore run doc immediately
    runRef = await firestore.collection("golf_booking_probes").add({
      started_at: new Date().toISOString(),
      requested_url: url,
      status: "in_progress"
    });

    const { default: chromium } = await import("@sparticuz/chromium");
    const playwright = await import("playwright-core");

    const browser = await playwright.chromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    });

    const page: Page = await context.newPage();

    // Capture the HTTP response for the navigation (if any)
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(1500); // let async redirects settle

    const finalUrl = page.url();
    const status = response?.status() ?? null;
    const statusText = response?.statusText?.() ?? null;
    const title = await page.title().catch(() => null);

    const bodyText = await page.evaluate(() =>
      document.body ? document.body.innerText.slice(0, 2000) : ""
    );

    const html = await page.content().catch(() => "");

    const screenshot = await page.screenshot({
      fullPage: true,
      type: "jpeg",
      quality: 70,
    });

    await browser.close();

    // Persist results
    await runRef.update({
      finished_at: new Date().toISOString(),
      status: "complete",
      resulting_url: finalUrl,
      http_status: status,
      http_status_text: statusText,
      page_title: title,
      body_text_sample: bodyText,
    });

    await runRef.collection("artifacts").add({
      type: "screenshot",
      mime: "image/jpeg",
      base64: screenshot.toString("base64"),
      created_at: new Date().toISOString(),
    });

    await runRef.collection("artifacts").add({
      type: "html",
      created_at: new Date().toISOString(),
      content: html.slice(0, 200_000),
    });

    return res.status(200).json({
      ok: true,
      probe_id: runRef.id,
      requested_url: url,
      resulting_url: finalUrl,
      status,
    });

  } catch (err: any) {
    if (runRef) {
      await runRef.update({
        finished_at: new Date().toISOString(),
        status: "error",
        error: err?.message || "Probe failed",
      });
    }

    return res.status(500).json({
      ok: false,
      error: err?.message || "Probe failed",
      probe_id: runRef?.id ?? null,
    });
  }
}
