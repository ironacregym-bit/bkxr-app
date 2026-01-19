
// lib/email.ts (dynamic import; no top-level import)
const HAVE_EMAIL =
  !!process.env.EMAIL_SERVER_HOST &&
  !!process.env.EMAIL_SERVER_PORT &&
  !!process.env.EMAIL_SERVER_USER &&
  !!process.env.EMAIL_SERVER_PASSWORD &&
  !!process.env.EMAIL_FROM;

/**
 * Sends an email via SMTP (same creds as NextAuth EmailProvider).
 * If SMTP isn't configured, logs to console (dev no-op).
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  if (!HAVE_EMAIL) {
    console.log("[email:dev]", { to: opts.to, subject: opts.subject });
    return;
  }

  // Avoids needing @types and sidesteps builder quirks.
  const nodemailer: any =
    (await import("nodemailer")).default ?? (await import("nodemailer"));

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT ?? 465),
    secure: String(process.env.EMAIL_SERVER_PORT ?? "465") === "465",
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}
