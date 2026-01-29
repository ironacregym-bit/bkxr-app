
import { test, expect } from '@playwright/test';
import { readPrefsFromEnv } from './config';
import { selectors } from './selectors';
import fs from 'node:fs';

const STORAGE_STATE = process.env.HDID_STORAGE_STATE_PATH ?? 'hdid-storage-state.json';

async function withLogin(page) {
  // If storage state exists, we’re already logged in
  if (fs.existsSync(STORAGE_STATE)) return;

  const email = process.env.HDID_EMAIL;
  const password = process.env.HDID_PASSWORD;
  if (!email || !password) throw new Error('Missing HDID_EMAIL or HDID_PASSWORD');

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Cookie banner (best-effort)
  const cookies = page.locator(selectors.acceptCookies);
  if (await cookies.first().isVisible().catch(() => false)) {
    await cookies.first().click({ timeout: 3000 }).catch(() => {});
  }

  // Open sign in
  const signIn = page.locator(selectors.signInLink);
  if (await signIn.first().isVisible().catch(() => false)) {
    await signIn.first().click();
  } else {
    // fallback: direct login URL if needed
    await page.goto('/Account/Login', { waitUntil: 'domcontentloaded' }).catch(() => {});
  }

  await page.locator(selectors.emailInput).fill(email);
  await page.locator(selectors.passwordInput).fill(password);
  await page.locator(selectors.signInButton).click();

  // Wait for a known authed UI element (adjust if site shows a profile avatar/user menu)
  await expect(page.locator('role=link[name=/My Account|Profile|Logout/i]')).toBeVisible({ timeout: 15000 });

  // Persist session
  await page.context().storageState({ path: STORAGE_STATE });
}

async function armUntil(timeHHmmSS?: string) {
  if (!timeHHmmSS) return;
  const [h,m,s] = timeHHmmSS.split(':').map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(h, m, s ?? 0, 0);
  if (target.getTime() <= now.getTime()) return;
  // Busy-wait with sleeps to hit exact second
  // Coarse sleep
  while (Date.now() < target.getTime() - 1500) await new Promise(r => setTimeout(r, 200));
  // Fine spin
  while (Date.now() < target.getTime()) {}
}

test('HDID booking', async ({ browser }) => {
  const prefs = readPrefsFromEnv();
  const context = await browser.newContext({ storageState: fs.existsSync(STORAGE_STATE) ? STORAGE_STATE : undefined });
  const page = await context.newPage();

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // Cookie banner again (storageState path may not include it)
  const cookies = page.locator(selectors.acceptCookies);
  if (await cookies.first().isVisible().catch(() => false)) {
    await cookies.first().click({ timeout: 3000 }).catch(() => {});
  }

  await withLogin(page);

  // Navigate to bookings
  // Adjust: some sites put it under "Tee Times" or "Bookings"
  const bookings = page.locator(selectors.bookingsNav);
  if (await bookings.first().isVisible().catch(() => false)) {
    await bookings.first().click();
  } else {
    // Try a direct path if your club has a known URL, else keep generic
    await page.goto('/Bookings', { waitUntil: 'domcontentloaded' }).catch(() => {});
  }

  // Optionally set club/course
  if (prefs.club) {
    const club = page.locator(selectors.clubPicker);
    if (await club.isVisible().catch(() => false)) {
      await club.selectOption({ label: prefs.club }).catch(async () => {
        await club.fill(prefs.club);
        await page.keyboard.press('Enter');
      });
    }
  }
  if (prefs.course) {
    const course = page.locator(selectors.coursePicker);
    if (await course.isVisible().catch(() => false)) {
      await course.selectOption({ label: prefs.course }).catch(async () => {
        await course.fill(prefs.course);
        await page.keyboard.press('Enter');
      });
    }
  }

  // Set the date
  const dp = page.locator(selectors.datePicker);
  if (await dp.isVisible().catch(() => false) && (await dp.getAttribute('type')) === 'date') {
    await dp.fill(prefs.dateYMD);
  } else {
    // If there’s a custom calendar widget, you’ll likely need to click the calendar and then choose the date cell.
    // Add a specific selector here once you run codegen.
    // Example: await page.locator(`role=button[name="${prefs.dateYMD}"]`).click();
  }

  // Arm until the release time if provided (e.g., 07:00:00)
  await armUntil(prefs.earliestOpenAt);

  // Choose tee time
  const timeBtn = page.locator(selectors.timeCell(prefs.teeTime));
  await expect(timeBtn.first()).toBeVisible({ timeout: 20_000 });
  await timeBtn.first().click();

  // Players
  const players = page.locator(selectors.playersPicker);
  if (await players.isVisible().catch(() => false)) {
    await players.selectOption(String(prefs.players)).catch(async () => {
      await players.fill(String(prefs.players));
      await page.keyboard.press('Enter');
    });
  }

  // Confirm flow (one or two steps depending on club)
  const confirm = page.locator(selectors.confirmButton);
  if (await confirm.first().isVisible().catch(() => false)) await confirm.first().click({ timeout: 10_000 }).catch(() => {});
  const finalise = page.locator(selectors.finaliseButton);
  if (await finalise.first().isVisible().catch(() => false)) await finalise.first().click({ timeout: 10_000 }).catch(() => {});

  // Success check
  await expect(page.locator(selectors.successToast)).toBeVisible({ timeout: 15_000 });

  await context.close();
});
