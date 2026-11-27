import type { NextApiRequest, NextApiResponse } from "next";
import { requireRole, requireTenantContext, sendApiError } from "@/lib/server-auth";
import { knowledgeSearchSchema } from "@/lib/knowledge-schemas";
import { findKnowledge } from "@/lib/knowledge-store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const context = await requireTenantContext(req, res);
    requireRole(context, ["platform_admin", "owner", "administrator"]);
    if (!req.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
      return res.status(415).json({ error: "Content-Type must be application/json" });
    }
    const parsed = knowledgeSearchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Enter a search query of up to 500 characters." });
    const results = await findKnowledge(context.tenantId, parsed.data.query);
    return res.status(200).json({ results });
  } catch (error) {
    return sendApiError(res, error, "Could not search knowledge");
  }
}
