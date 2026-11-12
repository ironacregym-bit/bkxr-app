import { sendMail } from "@/lib/email";

export async function sendLeadNotification(
  {
    name,
    email,
    source,
  }: {
    name: string;
    email: string;
    source: string;
  }
) {
  return sendMail({
    to:
      process.env.IRON_ACRE_NOTIFY_EMAIL!,
    subject:
      `New Iron Acre Lead (${source})`,
    html: `
      <h2>New Lead</h2>

      <p>
        <strong>Name:</strong>
        ${name}
      </p>

      <p>
        <strong>Email:</strong>
        ${email}
      </p>

      <p>
        <strong>Source:</strong>
        ${source}
      </p>
    `,
  });
}

export async function sendFreeProgramEmail(
  {
    name,
    email,
  }: {
    name: string;
    email: string;
  }
) {
  return sendMail({
    to: email,

    subject:
      "Your Free 7 Day Program",

    html: `
      <h1>
        Welcome to Iron Acre
      </h1>

      <p>
        Hi ${name},
      </p>

      <p>
        Thanks for claiming your
        free 7 day program.
      </p>

      <p>
        Download it here:
      </p>

      <p>
        <a href="${process.env.IRON_ACRE_PROGRAM_URL}">
          Get Your Program
        </a>
      </p>

      <p>
        If you'd like to claim
        your free class, simply
        reply to this email.
      </p>
    `,
  });
}
