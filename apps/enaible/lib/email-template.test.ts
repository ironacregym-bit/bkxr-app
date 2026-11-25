import { describe, expect, it } from "vitest";
import {
  getEmailTemplateVariables,
  renderEmailTemplate,
} from "./email-template";

describe("approved plain-text email templates", () => {
  it("renders only the template's declared variables", () => {
    const template = {
      subject: "Welcome, {{firstName}}",
      text: "Hi {{firstName}}, your code is {{code}}.",
    };

    expect(getEmailTemplateVariables(template)).toEqual([
      "code",
      "firstName",
    ]);
    expect(
      renderEmailTemplate(template, {
        firstName: "Ada",
        code: "1234",
      })
    ).toEqual({
      subject: "Welcome, Ada",
      text: "Hi Ada, your code is 1234.",
    });
    expect(() =>
      renderEmailTemplate(template, { firstName: "Ada" })
    ).toThrow("exactly the variables");
  });

  it("rejects malformed placeholders and subject line injection", () => {
    expect(() =>
      getEmailTemplateVariables({
        subject: "Hello {{firstName",
        text: "Text",
      })
    ).toThrow("invalid placeholder");
    expect(() =>
      renderEmailTemplate(
        { subject: "{{name}}", text: "Text {{name}}" },
        { name: "Ada\nBcc: other@example.com" }
      )
    ).toThrow("variable is invalid");
  });
});
