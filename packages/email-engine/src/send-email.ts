import { sendMail } from "../../../../lib/email";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  return sendMail({
    to,
    subject,
    html,
  });
}
