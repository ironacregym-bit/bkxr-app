import { createHash } from "crypto";
import type { DocumentReference } from "firebase-admin/firestore";
import type { NextApiRequest } from "next";
import {
  approvedEmailRequestSchema,
  sendEmail,
  type ApprovedEmailRequest,
} from "@pt/email-engine";
import { adminDb, ApiError } from "./server-auth";
import {
  matchesEmailApiSecret,
  parseEmailApiKey,
} from "./email-api-key";
import { isAllowedRecipientDomain } from "./email-policy";
import { createEmailApiKeySchema } from "./email-schemas";
import {
  getEmailTemplateVariables,
  renderEmailTemplate,
} from "./email-template";

const EMAIL_SEND_ATTEMPTS_PER_DAY = 20;

export type EmailApiKeyRecord = {
  tenantId: string;
  keyId: string;
  name: string;
  secretHash: string;
  scope: "email:send";
  allowedRecipientDomains: string[];
  createdBy: string;
  createdAt: string;
  revokedAt?: string;
  revokedBy?: string;
  dailySendDate?: string;
  dailySendCount?: number;
};

export type EmailApiCredential = {
  tenantId: string;
  keyId: string;
  allowedRecipientDomains: string[];
  keyRef: DocumentReference;
};

export type EmailTemplateRecord = {
  tenantId: string;
  templateId: string;
  name: string;
  subject: string;
  text: string;
  status: "approved" | "revoked";
  createdBy: string;
  createdAt: string;
  revokedAt?: string;
  revokedBy?: string;
};

export async function requireEmailApiCredential(req: NextApiRequest) {
  const authorization = req.headers.authorization || "";
  const match = /^Bearer (.+)$/i.exec(authorization);
  const parsed = match ? parseEmailApiKey(match[1]) : null;
  if (!parsed) {
    throw new ApiError(401, "A valid email API key is required");
  }

  const keyRef = adminDb
    .collection("tenants")
    .doc(parsed.tenantId)
    .collection("emailApiKeys")
    .doc(parsed.keyId);
  const tenantRef = adminDb.collection("tenants").doc(parsed.tenantId);
  const [keySnapshot, tenantSnapshot] = await Promise.all([
    keyRef.get(),
    tenantRef.get(),
  ]);
  if (!keySnapshot.exists || !tenantSnapshot.exists) {
    throw new ApiError(401, "A valid email API key is required");
  }

  const record = keySnapshot.data() as EmailApiKeyRecord | undefined;
  if (
    !record ||
    record.tenantId !== parsed.tenantId ||
    record.keyId !== parsed.keyId ||
    record.scope !== "email:send" ||
    record.revokedAt ||
    !Array.isArray(record.allowedRecipientDomains) ||
    typeof record.secretHash !== "string"
  ) {
    throw new ApiError(401, "A valid email API key is required");
  }
  const keyPolicy = createEmailApiKeySchema.safeParse({
    name: record.name,
    allowedRecipientDomains: record.allowedRecipientDomains,
  });
  if (!keyPolicy.success) {
    throw new Error("Email API key has invalid stored policy.");
  }

  if (!matchesEmailApiSecret(parsed.secret, record.secretHash)) {
    throw new ApiError(401, "A valid email API key is required");
  }

  if (tenantSnapshot.get("tenantId") !== parsed.tenantId) {
    throw new ApiError(401, "A valid email API key is required");
  }

  return {
    tenantId: parsed.tenantId,
    keyId: parsed.keyId,
    allowedRecipientDomains: record.allowedRecipientDomains,
    keyRef,
  } satisfies EmailApiCredential;
}

function assertRecipientDomain(recipient: string, allowedDomains: string[]) {
  if (!isAllowedRecipientDomain(recipient, allowedDomains)) {
    throw new ApiError(
      403,
      "The recipient domain is not allowed for this email API key"
    );
  }
}

export async function sendApprovedTemplateEmail(
  credential: EmailApiCredential,
  input: ApprovedEmailRequest
) {
  const parsed = approvedEmailRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message || "Invalid email request"
    );
  }

  assertRecipientDomain(
    parsed.data.to,
    credential.allowedRecipientDomains
  );

  const requestId = createHash("sha256")
    .update(`${credential.keyId}:${parsed.data.idempotencyKey}`)
    .digest("hex");
  const tenantRef = adminDb.collection("tenants").doc(credential.tenantId);
  const requestRef = tenantRef.collection("emailRequests").doc(requestId);
  const templateRef = tenantRef
    .collection("emailTemplates")
    .doc(parsed.data.templateId);
  const variables = Object.fromEntries(
    Object.entries(parsed.data.variables).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0
    )
  );
  const payloadHash = createHash("sha256")
    .update(
      JSON.stringify({
        templateId: parsed.data.templateId,
        to: parsed.data.to.toLowerCase(),
        variables,
      })
    )
    .digest("hex");
  const today = new Date().toISOString().slice(0, 10);

  const reservation = await adminDb.runTransaction(async (transaction) => {
    const keySnapshot = await transaction.get(credential.keyRef);
    const requestSnapshot = await transaction.get(requestRef);
    if (!keySnapshot.exists) {
      throw new ApiError(401, "Email API key is no longer active");
    }

    const keyRecord = keySnapshot.data() as EmailApiKeyRecord | undefined;
    if (
      !keyRecord ||
      keyRecord.tenantId !== credential.tenantId ||
      keyRecord.keyId !== credential.keyId ||
      keyRecord.revokedAt
    ) {
      throw new ApiError(401, "Email API key is no longer active");
    }

    if (requestSnapshot.exists) {
      const previous = requestSnapshot.data();
      if (
        previous?.tenantId !== credential.tenantId ||
        previous?.keyId !== credential.keyId ||
        previous?.requestId !== requestId
      ) {
        throw new Error("Email idempotency record has invalid tenant metadata.");
      }
      if (previous?.payloadHash !== payloadHash) {
        throw new ApiError(
          409,
          "The idempotency key was already used for a different email"
        );
      }
      if (previous?.status === "sent") {
        return { alreadySent: true };
      }
      throw new ApiError(
        409,
        "This email request is already being processed or previously failed"
      );
    }

    const templateSnapshot = await transaction.get(templateRef);
    const template = templateSnapshot.data() as
      | EmailTemplateRecord
      | undefined;
    if (
      !templateSnapshot.exists ||
      !template ||
      template.tenantId !== credential.tenantId ||
      template.templateId !== parsed.data.templateId ||
      template.status !== "approved" ||
      typeof template.subject !== "string" ||
      typeof template.text !== "string"
    ) {
      throw new ApiError(404, "Approved email template not found");
    }

    let rendered: { subject: string; text: string };
    try {
      rendered = renderEmailTemplate(
        { subject: template.subject, text: template.text },
        variables
      );
    } catch (error) {
      throw new ApiError(
        400,
        error instanceof Error ? error.message : "Invalid template variables"
      );
    }

    const sendsToday =
      keyRecord.dailySendDate === today ? keyRecord.dailySendCount : 0;
    if (
      typeof sendsToday !== "number" ||
      !Number.isInteger(sendsToday) ||
      sendsToday < 0
    ) {
      throw new Error("Email API key has an invalid daily send counter.");
    }
    if (sendsToday >= EMAIL_SEND_ATTEMPTS_PER_DAY) {
      throw new ApiError(429, "Daily email send limit reached");
    }

    transaction.update(credential.keyRef, {
      dailySendDate: today,
      dailySendCount: sendsToday + 1,
    });
    transaction.create(requestRef, {
      tenantId: credential.tenantId,
      requestId,
      keyId: credential.keyId,
      templateId: parsed.data.templateId,
      recipient: parsed.data.to,
      payloadHash,
      status: "sending",
      createdAt: new Date().toISOString(),
    });
    return { alreadySent: false, rendered };
  });

  if (reservation.alreadySent) {
    return { requestId, status: "sent" as const, duplicate: true };
  }

  try {
    await sendEmail({
      to: parsed.data.to,
      subject: reservation.rendered.subject,
      text: reservation.rendered.text,
    });
  } catch (error) {
    await requestRef.update({
      status: "failed",
      failedAt: new Date().toISOString(),
    });
    throw error;
  }

  await requestRef.update({
    status: "sent",
    sentAt: new Date().toISOString(),
  });

  return { requestId, status: "sent" as const };
}

export async function listApprovedEmailTemplates(tenantId: string) {
  const snapshot = await adminDb
    .collection("tenants")
    .doc(tenantId)
    .collection("emailTemplates")
    .where("status", "==", "approved")
    .get();

  return snapshot.docs.map((document) => {
    const template = document.data() as EmailTemplateRecord;
    if (
      template.tenantId !== tenantId ||
      template.templateId !== document.id ||
      template.status !== "approved" ||
      typeof template.name !== "string" ||
      typeof template.subject !== "string" ||
      typeof template.text !== "string" ||
      typeof template.createdAt !== "string"
    ) {
      throw new Error(`Invalid email template record: ${document.ref.path}`);
    }

    return {
      templateId: template.templateId,
      name: template.name,
      subject: template.subject,
      text: template.text,
      variables: getEmailTemplateVariables(template),
      createdAt: template.createdAt,
    };
  });
}
