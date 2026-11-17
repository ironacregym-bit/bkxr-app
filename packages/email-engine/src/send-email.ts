import { sendMail } from "../../../../lib/email";

export interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(
  request: SendEmailRequest
) {
  return sendMail({
    to: request.to,
    subject: request.subject,
    html: request.html,
    text: request.text,
  });
}
