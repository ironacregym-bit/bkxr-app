import { describe, expect, it } from "vitest";
import { approvedEmailRequestSchema } from "@pt/email-engine/approved-email";
import {
  createEmailApiKeySchema,
  createEmailTemplateSchema,
} from "./email-schemas";

describe("email integration schemas", () => {
  it("normalizes exact recipient domains and removes duplicates", () => {
    expect(
      createEmailApiKeySchema.parse({
        name: "Automation",
        allowedRecipientDomains: [" Example.com ", "example.com"],
      }).allowedRecipientDomains
    ).toEqual(["example.com"]);

    expect(
      createEmailApiKeySchema.safeParse({
        name: "Automation",
        allowedRecipientDomains: ["*.example.com"],
      }).success
    ).toBe(false);
  });

  it("rejects malformed or oversized approved template content", () => {
    expect(
      createEmailTemplateSchema.safeParse({
        name: "Welcome",
        subject: "Welcome\nInjected header",
        text: "Hello {{firstName}}",
      }).success
    ).toBe(false);
    expect(
      createEmailTemplateSchema.safeParse({
        name: "Welcome",
        subject: "Welcome",
        text: "x".repeat(8001),
      }).success
    ).toBe(false);
  });

  it("accepts only template references and bounded variables, not free-form bodies", () => {
    const valid = approvedEmailRequestSchema.safeParse({
      templateId: "a".repeat(18),
      to: "person@example.com",
      variables: { firstName: "Ada" },
      idempotencyKey: "welcome-2026-01",
    });
    expect(valid.success).toBe(true);

    expect(
      approvedEmailRequestSchema.safeParse({
        templateId: "a".repeat(18),
        to: "person@example.com",
        variables: { body: "arbitrary message" },
        idempotencyKey: "welcome-2026-01",
        html: "<h1>free form</h1>",
      }).success
    ).toBe(false);
  });
});
