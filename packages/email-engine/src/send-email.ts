type EmailMessage = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

type SmtpOptions = {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
};

type SmtpTransport = {
  sendMail(message: EmailMessage & { from: string }): Promise<unknown>;
};

type NodemailerModule = {
  createTransport(options: SmtpOptions): SmtpTransport;
};

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: EmailMessage) {
  const host = process.env.EMAIL_SERVER_HOST;
  const user = process.env.EMAIL_SERVER_USER;
  const password = process.env.EMAIL_SERVER_PASSWORD;
  const from = process.env.EMAIL_FROM;
  const port = Number(process.env.EMAIL_SERVER_PORT || 465);

  if (!host || !user || !password || !from) {
    throw new Error(
      "Email is not configured. Set EMAIL_SERVER_HOST, EMAIL_SERVER_USER, EMAIL_SERVER_PASSWORD, and EMAIL_FROM."
    );
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("EMAIL_SERVER_PORT must be a valid TCP port.");
  }
  if (!html && !text) {
    throw new Error("An email must include HTML or plain-text content.");
  }

  const nodemailer = require("nodemailer") as NodemailerModule;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass: password,
    },
  });

  return transporter.sendMail({
    from,
    to,
    subject,
    html,
    text,
  });
}
