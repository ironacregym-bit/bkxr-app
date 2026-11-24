import { describe, expect, it } from "vitest";
import {
  createOrganizationSchema,
  tenantRoleSchema,
} from "./schemas";

describe("organisation and membership schemas", () => {
  it("trims and validates organisation names", () => {
    expect(createOrganizationSchema.parse({ name: "  Acme  " }).name).toBe(
      "Acme"
    );
    expect(createOrganizationSchema.safeParse({ name: " " }).success).toBe(
      false
    );
    expect(
      createOrganizationSchema.safeParse({ name: "x".repeat(81) }).success
    ).toBe(false);
  });

  it("rejects roles outside the explicit role set", () => {
    expect(tenantRoleSchema.safeParse("owner").success).toBe(true);
    expect(tenantRoleSchema.safeParse("superuser").success).toBe(false);
  });
});
