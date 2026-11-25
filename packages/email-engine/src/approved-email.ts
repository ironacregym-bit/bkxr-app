import { z } from "zod";

export const approvedEmailRequestSchema = z.object({
  templateId: z.string().regex(/^[a-f0-9]{18}$/),
  to: z.string().trim().email().max(254),
  variables: z
    .record(
      z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,39}$/),
      z.string().max(500)
    )
    .refine((variables) => Object.keys(variables).length <= 20),
  idempotencyKey: z
    .string()
    .trim()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9._:-]+$/),
}).strict();

export type ApprovedEmailRequest = z.infer<
  typeof approvedEmailRequestSchema
>;

export const approvedEmailResponseSchema = z.object({
  requestId: z.string(),
  status: z.literal("sent"),
  duplicate: z.boolean().optional(),
});

export type ApprovedEmailResponse = z.infer<
  typeof approvedEmailResponseSchema
>;
