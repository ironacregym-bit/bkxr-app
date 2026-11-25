import { z } from "zod";

const emailDomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(
    /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/,
    "Enter a valid recipient domain"
  );

export const createEmailApiKeySchema = z.object({
  name: z.string().trim().min(2).max(60),
  allowedRecipientDomains: z
    .array(emailDomainSchema)
    .min(1)
    .max(20)
    .transform((domains) => [...new Set(domains)]),
}).strict();

export const revokeEmailApiKeySchema = z.object({
  keyId: z.string().regex(/^[a-f0-9]{18}$/),
}).strict();

export const createEmailTemplateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  subject: z.string().trim().min(1).max(160).regex(/^[^\r\n]+$/),
  text: z.string().trim().min(1).max(8000),
}).strict();

export const revokeEmailTemplateSchema = z.object({
  templateId: z.string().regex(/^[a-f0-9]{18}$/),
}).strict();
