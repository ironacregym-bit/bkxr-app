import { sendEmail } from "../../../packages/email-engine/src/send-email";
import { getServerSiteUrl } from "./site-url";

type LeadEmailInput = {
  name: string;
  email: string;
  source: string;
};

export type LeadCampaign =
  | "free-program"
  | "winter-arc-2027"
  | "coaching";

export type LeadEmailDelivery = {
  status: "sent" | "partial" | "pending";
  notificationSent: boolean;
  confirmationSent: boolean;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

async function sendLeadNotification({
  name,
  email,
  source,
}: LeadEmailInput) {
  const recipient =
    process.env.IRON_ACRE_NOTIFY_EMAIL ||
    process.env.EMAIL_SERVER_USER;

  if (!recipient) {
    throw new Error(
      "Set IRON_ACRE_NOTIFY_EMAIL or EMAIL_SERVER_USER to receive lead notifications."
    );
  }

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSource = escapeHtml(source);

  return sendEmail({
    to: recipient,
    subject: `New Iron Acre lead (${source.replace(/[\r\n]/g, " ")})`,
    text: `New Iron Acre lead\nName: ${name}\nEmail: ${email}\nSource: ${source}`,
    html: `
      <h2>New Iron Acre lead</h2>
      <p><strong>Name:</strong> ${safeName}</p>
      <p><strong>Email:</strong> ${safeEmail}</p>
      <p><strong>Source:</strong> ${safeSource}</p>
    `,
  });
}

async function sendFreeProgramConfirmation({
  name,
  email,
}: LeadEmailInput) {
  const safeName = escapeHtml(name);
  const siteUrl = getServerSiteUrl();
  const programUrl =
    process.env.IRON_ACRE_PROGRAM_URL ||
    (siteUrl ? `${siteUrl}/#free-program` : undefined);
  const safeProgramUrl = programUrl
    ? escapeHtml(programUrl)
    : undefined;

  return sendEmail({
    to: email,
    subject: "Your Iron Acre free training plan",
    text: [
      `Hi ${name},`,
      "",
      "Thanks for requesting the Iron Acre free 7-day training plan.",
      safeProgramUrl
        ? `Access it here: ${programUrl}`
        : "We'll send the plan details shortly. Reply to this email if you have any questions.",
      "",
      "Iron Acre Gym",
    ].join("\n"),
    html: `
      <h1>Your free 7-day training plan</h1>
      <p>Hi ${safeName},</p>
      <p>Thanks for requesting the Iron Acre free 7-day training plan.</p>
      ${
        safeProgramUrl
          ? `<p><a href="${safeProgramUrl}">Access your plan</a></p>`
          : "<p>We will send the plan details shortly. Reply to this email if you have any questions.</p>"
      }
      <p>Iron Acre Gym</p>
    `,
  });
}

async function sendWinterArcConfirmation({
  name,
  email,
}: LeadEmailInput) {
  const safeName = escapeHtml(name);

  return sendEmail({
    to: email,
    subject: "You're on the Winter Arc 2027 interest list",
    text: [
      `Hi ${name},`,
      "",
      "We've received your Winter Arc 2027 enquiry.",
      "The programme is planned to start in the second week of January 2027 and costs £100 per month.",
      "It includes two workouts each week, an online coach and an online workout plan.",
      "We'll be in touch with more details. This email confirms your interest only; it is not a paid booking.",
      "",
      "Iron Acre Gym",
    ].join("\n"),
    html: `
      <h1>Winter Arc 2027</h1>
      <p>Hi ${safeName},</p>
      <p>We've received your Winter Arc 2027 enquiry.</p>
      <p>The programme is planned to start in the second week of January 2027 and costs <strong>£100 per month</strong>.</p>
      <p>It includes two workouts each week, an online coach and an online workout plan.</p>
      <p>We'll be in touch with more details. This email confirms your interest only; it is not a paid booking.</p>
      <p>Iron Acre Gym</p>
    `,
  });
}

async function sendCoachingConfirmation({
  name,
  email,
}: LeadEmailInput) {
  const safeName = escapeHtml(name);

  return sendEmail({
    to: email,
    subject: "We received your Iron Acre coaching enquiry",
    text: `Hi ${name},\n\nThanks for your Iron Acre online coaching enquiry. Rob will review it and get back to you soon.\n\nIron Acre Gym`,
    html: `
      <h1>Coaching enquiry received</h1>
      <p>Hi ${safeName},</p>
      <p>Thanks for your Iron Acre online coaching enquiry. Rob will review it and get back to you soon.</p>
      <p>Iron Acre Gym</p>
    `,
  });
}

export async function sendLeadEmails({
  name,
  email,
  source,
  campaign,
}: LeadEmailInput & { campaign: LeadCampaign }): Promise<LeadEmailDelivery> {
  const confirmation = {
    "free-program": sendFreeProgramConfirmation,
    "winter-arc-2027": sendWinterArcConfirmation,
    coaching: sendCoachingConfirmation,
  }[campaign];

  const results = await Promise.allSettled([
    sendLeadNotification({ name, email, source }),
    confirmation({ name, email, source }),
  ]);
  const notificationSent = results[0].status === "fulfilled";
  const confirmationSent = results[1].status === "fulfilled";
  const sentCount = Number(notificationSent) + Number(confirmationSent);

  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      console.error(
        index === 0
          ? "Iron Acre lead notification email failed"
          : "Iron Acre lead confirmation email failed",
        result.reason
      );
    }
  }

  return {
    status:
      sentCount === 2
        ? "sent"
        : sentCount === 1
          ? "partial"
          : "pending",
    notificationSent,
    confirmationSent,
  };
}
