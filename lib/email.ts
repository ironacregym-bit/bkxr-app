
// lib/email.ts

// We lazy-load nodemailer so TypeScript doesn't need @types/nodemailer
// and so builds don't fail when SMTP isn't configured.
const HAVE_EMAIL =
  !!process.env.EMAIL_SERVER_HOST &&
  !!process.env.EMAIL_SERVER_PORT &&
  !!process.env.EMAIL_SERVER_USER &&
  !!process.env.EMAIL_SERVER_PASSWORD &&
  !!process.env.EMAIL_FROM;

/**
 * Sends an email via the same SMTP credentials used by NextAuth EmailProvider.
 * - If SMTP isn't configured, we log to console (safe no-op for dev).
 * - Nodemailer is imported dynamically to avoid type dependency during build.
 */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  if (!HAVE_EMAIL) {
    // Safe no-op in environments without SMTP; keeps flows working in dev
    console.log("[email:dev]", { to: opts.to, subject: opts.subject });
    return;
  }

  // Dynamic import to avoid TS type dependency and reduce cold start
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nodemailer: any = (await import("nodemailer")).default ?? (await import("nodemailer"));

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
