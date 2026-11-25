import type { NextApiRequest, NextApiResponse } from "next";
import {
  adminDb,
  ApiError,
  requireRole,
  requireTenantContext,
  sendApiError,
} from "@/lib/server-auth";
import { type EmailApiKeyRecord } from "@/lib/email-api";
import { createEmailApiKey } from "@/lib/email-api-key";
import {
  createEmailApiKeySchema,
  revokeEmailApiKeySchema,
} from "@/lib/email-schemas";

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
    const context = await requireTenantContext(req);
    requireRole(context, ["platform_admin", "owner", "administrator"]);
    const tenantRef = adminDb.collection("tenants").doc(context.tenantId);
    const keysRef = tenantRef.collection("emailApiKeys");

    if (req.method === "GET") {
      const snapshot = await keysRef.get();
      const keys = snapshot.docs.map((document) => {
        const record = document.data() as EmailApiKeyRecord;
        if (
          record.tenantId !== context.tenantId ||
          record.keyId !== document.id ||
          typeof record.name !== "string" ||
          !Array.isArray(record.allowedRecipientDomains) ||
          typeof record.createdAt !== "string"
        ) {
          throw new Error(`Invalid email API key record: ${document.ref.path}`);
        }

        return {
          keyId: record.keyId,
          name: record.name,
          allowedRecipientDomains: record.allowedRecipientDomains,
          createdAt: record.createdAt,
          revokedAt: record.revokedAt || null,
        };
      });
      return res.status(200).json({ keys });
    }

    if (req.method === "POST") {
      if (!requireJson(req, res)) return;
      const parsed = createEmailApiKeySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || "Invalid email API key",
        });
      }

      const generated = createEmailApiKey(context.tenantId);
      const keyRef = keysRef.doc(generated.keyId);
      const now = new Date().toISOString();
      await keyRef.create({
        tenantId: context.tenantId,
        keyId: generated.keyId,
        name: parsed.data.name,
        secretHash: generated.secretHash,
        scope: "email:send",
        allowedRecipientDomains: parsed.data.allowedRecipientDomains,
        createdBy: context.uid,
        createdAt: now,
      } satisfies EmailApiKeyRecord);

      return res.status(201).json({
        apiKey: generated.token,
        key: {
          keyId: generated.keyId,
          name: parsed.data.name,
          allowedRecipientDomains: parsed.data.allowedRecipientDomains,
          createdAt: now,
          revokedAt: null,
        },
      });
    }

    if (req.method === "DELETE") {
      if (!requireJson(req, res)) return;
      const parsed = revokeEmailApiKeySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: parsed.error.issues[0]?.message || "Invalid key ID",
        });
      }

      const keyRef = keysRef.doc(parsed.data.keyId);
      const keySnapshot = await keyRef.get();
      const record = keySnapshot.data() as EmailApiKeyRecord | undefined;
      if (
        !keySnapshot.exists ||
        !record ||
        record.tenantId !== context.tenantId ||
        record.keyId !== parsed.data.keyId
      ) {
        throw new ApiError(404, "Email API key not found");
      }

      await keyRef.update({
        revokedAt: new Date().toISOString(),
        revokedBy: context.uid,
      });
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return sendApiError(res, error, "Could not manage email API keys");
  }
}
