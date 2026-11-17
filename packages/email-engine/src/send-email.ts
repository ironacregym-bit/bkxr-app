import { sendMail } from "../../../lib/email";

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  return sendMail({
    to,
    subject,
    html,
    text,
  });
}
