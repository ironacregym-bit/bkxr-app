
// lib/notifications/email.ts
import { sendMail } from "../email";

/**
 * If later you want per-user email opt-out, add a check of users/{email} here.
 */
export async function sendEmailIfOptedIn(
  email: string,
  args: { subject: string; bodyHtml: string; bodyText?: string }
) {
  await sendMail({
    to: email,
    subject: args.subject,
    html: args.bodyHtml,
    text: args.bodyText,
  });
}
