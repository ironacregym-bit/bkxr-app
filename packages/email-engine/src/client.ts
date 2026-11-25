import {
  approvedEmailRequestSchema,
  approvedEmailResponseSchema,
  type ApprovedEmailRequest,
} from "./approved-email";

export async function sendApprovedEmail({
  serviceUrl,
  apiKey,
  ...input
}: ApprovedEmailRequest & {
  serviceUrl: string;
  apiKey: string;
}) {
  const parsed = approvedEmailRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(
      `Invalid approved email request: ${parsed.error.issues[0]?.message || "invalid input"}`
    );
  }

  if (!serviceUrl || !apiKey) {
    throw new Error("Email service URL and API key are required.");
  }

  const baseUrl = new URL(serviceUrl);
  const isLocalHttp =
    baseUrl.protocol === "http:" &&
    (baseUrl.hostname === "localhost" || baseUrl.hostname === "127.0.0.1");
  if (
    (baseUrl.protocol !== "https:" && !isLocalHttp) ||
    baseUrl.username ||
    baseUrl.password
  ) {
    throw new Error("Email service URL must use HTTPS.");
  }

  const response = await fetch(new URL("/api/email/send", baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": parsed.data.idempotencyKey,
    },
    body: JSON.stringify({
      templateId: parsed.data.templateId,
      to: parsed.data.to,
      variables: parsed.data.variables,
    }),
  });
  const result: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "Email service request failed.";
    throw new Error(message);
  }

  return approvedEmailResponseSchema.parse(result);
}
