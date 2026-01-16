
// pages/api/integrations/hdidido/runner.ts
import type { NextApiRequest, NextApiResponse } from "next";
import firestore from "../../../../lib/firestoreClient";
import { decryptJson } from "../../../../lib/crypto";

const LOGIN_URL = "https://www.howdidido.com/Account/Login";

// ✅ HARD-CODED TARGET
const BOOKING_ADD_URL =
  "https://howdidido-whs.clubv1.com/HDIDBooking/BookingAdd" +
  "?dateTime=2026-01-18T06%3A00" +
  "&courseId=12274" +
  "&startPoint=1" +
  "&crossOverStartPoint=0" +
  "&crossOverMinutes=0" +
  "&releasedReservation=False";

// ✅ HARD-CODED USER
const USER_EMAIL = "ben.jones1974@hotmail.co.uk";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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

    // ✅ Credentials (env or encrypted override later)
    const password = process.env.HDIDIDO_PASSWORD;
    if (!password) {
      throw new Error("HDIDIDO_PASSWORD env var not set");
    }

    // ---------------- LOGIN ----------------
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });

    await page.fill('input[type="email"]', USER_EMAIL);
    await page.fill('input[type="password"]', password);

    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle", { timeout: 20000 });

    // ✅ Snapshot: post-login
    const loginShot = await page.screenshot({ type: "jpeg", quality: 70 });

    // ---------------- DIRECT BOOKING ----------------
    await page.goto(BOOKING_ADD_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForLoadState("networkidle", { timeout: 20000 });

    // ✅ Snapshot: booking page
    const bookingShot = await page.screenshot({ type: "jpeg", quality: 70 });

    await ctx.close();
    await browser.close();

    return res.status(200).json({
      ok: true,
      outcome: "success",
      user: USER_EMAIL,
      bookingUrl: BOOKING_ADD_URL,
      screenshots: {
        login: `data:image/jpeg;base64,${loginShot.toString("base64")}`,
        booking: `data:image/jpeg;base64,${bookingShot.toString("base64")}`,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      outcome: "failed",
      error: err?.message || "Runner error",
    });
  }
}
