
// lib/email.ts
import nodemailer from "nodemailer";

const HAVE_EMAIL =
  !!process.env.EMAIL_SERVER_HOST &&
  !!process.env.EMAIL_SERVER_PORT &&
  !!process.env.EMAIL_SERVER_USER &&
  !!process.env.EMAIL_SERVER_PASSWORD &&
  !!process.env.EMAIL_FROM;

const transporter = HAVE_EMAIL
  ? nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT ?? 465),
      secure: String(process.env.EMAIL_SERVER_PORT ?? "465") === "465",
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    })
  : null;

export async function sendMail(opts: { to: string; subject: string; html: string; text?: string }) {
  if (!transporter) {
    console.log("[email:dev]", opts.subject, opts.to);
    return;
  }
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}
