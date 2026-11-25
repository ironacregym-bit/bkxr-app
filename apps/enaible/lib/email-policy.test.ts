import { describe, expect, it } from "vitest";
import { isAllowedRecipientDomain } from "./email-policy";

describe("email recipient domain policy", () => {
  it("allows exact domain matches but not lookalike or subdomains", () => {
    const domains = ["example.com"];

    expect(isAllowedRecipientDomain("person@EXAMPLE.com", domains)).toBe(true);
    expect(isAllowedRecipientDomain("person@mail.example.com", domains)).toBe(
      false
    );
    expect(isAllowedRecipientDomain("person@example.com.attacker.test", domains)).toBe(
      false
    );
  });
});
