import { z } from "zod";

export const tenantRoleSchema = z.enum([
  "platform_admin",
  "owner",
  "administrator",
  "operator",
  "approver",
  "read_only",
]);

export const organizationNameSchema = z
  .string()
  .trim()
  .min(2, "Organisation name must be at least 2 characters")
  .max(80, "Organisation name must be 80 characters or fewer");

export const createOrganizationSchema = z.object({
  name: organizationNameSchema,
});

export type TenantRole = z.infer<typeof tenantRoleSchema>;

export type OrganizationMembership = {
  tenantId: string;
  name: string;
  role: TenantRole;
};
