import { randomBytes } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import {
  adminDb,
  ApiError,
  requireRole,
  requireTenantContext,
  sendApiError,
} from "@/lib/server-auth";
import {
  createEmailTemplateSchema,
  revokeEmailTemplateSchema,
} from "@/lib/email-schemas";
import {
  type EmailTemplateRecord,
} from "@/lib/email-api";
import { getEmailTemplateVariables } from "@/lib/email-template";

function requireJson(req: NextApiRequest, res: NextApiResponse) {
  if (
    typeof req.headers["content-type"] !== "string" ||
    !req.headers["content-type"].startsWith("application/json")
  ) {
    res.status(415).json({ error: "Content-Type must be application/json" });
    return false;
  }
  return true;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const context = await requireTenantContext(req, res);
    requireRole(context, ["platform_admin", "owner", "administrator"]);
    const templatesRef = adminDb
      .collection("tenants")
      .doc(context.tenantId)
      .collection("emailTemplates");

    if (req.method === "GET") {
      const snapshot = await templatesRef.get();
      const templates = snapshot.docs.map((document) => {
        const template = document.data() as EmailTemplateRecord;
        if (
          template.tenantId !== context.tenantId ||
          template.templateId !== document.id ||
          typeof template.name !== "string" ||
          typeof template.subject !== "string" ||
          typeof template.text !== "string" ||
          !["approved", "revoked"].includes(template.status)
        ) {
          throw new Error(`Invalid email template record: ${document.ref.path}`);
        }

        return {
          templateId: template.templateId,
          name: template.name,
          subject: template.subject,
          text: template.text,
          variables: getEmailTemplateVariables(template),
          status: template.status,
          createdAt: template.createdAt,
          revokedAt: template.revokedAt || null,
        };
      });
      return res.status(200).json({ templates });
    }

    if (req.method === "POST") {
      if (!requireJson(req, res)) return;
      const parsed = createEmailTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || "Invalid email template",
        });
      }

      let variables: string[];
      try {
        variables = getEmailTemplateVariables(parsed.data);
      } catch (error) {
        return res.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Invalid email template placeholders",
        });
      }

      const templateId = randomBytes(9).toString("hex");
      const now = new Date().toISOString();
      const template: EmailTemplateRecord = {
        tenantId: context.tenantId,
        templateId,
        name: parsed.data.name,
        subject: parsed.data.subject,
        text: parsed.data.text,
        status: "approved",
        createdBy: context.uid,
        createdAt: now,
      };
      await templatesRef.doc(templateId).create(template);
      return res.status(201).json({
        template: {
          templateId,
          name: template.name,
          subject: template.subject,
          text: template.text,
          variables,
          status: template.status,
          createdAt: now,
          revokedAt: null,
        },
      });
    }

    if (req.method === "DELETE") {
      if (!requireJson(req, res)) return;
      const parsed = revokeEmailTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error:
            parsed.error.issues[0]?.message || "Invalid email template ID",
        });
      }

      const templateRef = templatesRef.doc(parsed.data.templateId);
      const snapshot = await templateRef.get();
      const template = snapshot.data() as EmailTemplateRecord | undefined;
      if (
        !snapshot.exists ||
        !template ||
        template.tenantId !== context.tenantId ||
        template.templateId !== parsed.data.templateId
      ) {
        throw new ApiError(404, "Email template not found");
      }
      if (template.status === "revoked") {
        return res.status(200).json({ ok: true });
      }

      await templateRef.update({
        status: "revoked",
        revokedAt: new Date().toISOString(),
        revokedBy: context.uid,
      });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return sendApiError(res, error, "Could not manage email templates");
  }
}
