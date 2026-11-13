import { sendMail } from "../../lib/email";

export async function sendLeadNotification({
  name,
  email,
  source,
}: {
  name: string;
  email: string;
  source: string;
}) {
  return sendMail({
    to: process.env.IRON_ACRE_NOTIFY_EMAIL!,
    subject: `New Iron Acre Lead (${source})`,
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

export async function sendFreeProgramEmail({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  return sendMail({
    to: email,
    subject: "Your Free 7 Day Program",
    html: `
      <h1>Welcome to Iron Acre</h1>

      <p>
        Hi ${name},
      </p>

      <p>
        Thanks for claiming your free
        7 day program.
      </p>

      <p>
        Download it here:
      </p>

      <p>
        <a href="${process.env.IRON_ACRE_PROGRAM_URL}">
          Download Program
        </a>
      </p>

      <p>
        Your first class is free.
        Simply reply to this email
        if you'd like to book in.
      </p>
    `,
  });
}

export async function sendCoachingApplicationNotification({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  return sendMail({
    to: process.env.IRON_ACRE_NOTIFY_EMAIL!,
    subject: "New Coaching Application",
    html: `
      <h2>New Coaching Application</h2>

      <p>
        <strong>Name:</strong>
        ${name}
      </p>

      <p>
        <strong>Email:</strong>
        ${email}
      </p>
    `,
  });
}

export async function sendCoachingApplicationReceivedEmail({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  return sendMail({
    to: email,
    subject: "Your Coaching Application",
    html: `
      <h1>Application Received</h1>

      <p>
        Hi ${name},
      </p>

      <p>
        Thanks for applying for
        Iron Acre Online Coaching.
      </p>

      <p>
        I'll review your application
        personally and get back to
        you shortly.
      </p>

      <p>
        Speak soon,
        <br />
        Rob
      </p>
    `,
  });
}
