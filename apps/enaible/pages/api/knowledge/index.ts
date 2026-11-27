import type { NextApiRequest, NextApiResponse } from "next";
import { adminDb, ApiError, requireRole, requireTenantContext, sendApiError } from "@/lib/server-auth";
import { knowledgeDocumentSchema, knowledgeIdSchema } from "@/lib/knowledge-schemas";
import { listKnowledge } from "@/lib/knowledge-store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const context = await requireTenantContext(req, res);
    requireRole(context, ["platform_admin", "owner", "administrator"]);
    const collection = adminDb.collection("tenants").doc(context.tenantId).collection("knowledge");

    if (req.method === "GET") return res.status(200).json({ documents: await listKnowledge(context.tenantId) });

    if ((req.method === "POST" || req.method === "DELETE") &&
        !req.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
      return res.status(415).json({ error: "Content-Type must be application/json" });
    }

    if (req.method === "POST") {
      const parsed = knowledgeDocumentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Enter a title and up to 20,000 characters of text." });
      const doc = collection.doc();
      const counter = adminDb.collection("tenants").doc(context.tenantId).collection("settings").doc("knowledge");
      await adminDb.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(counter);
        const count = snapshot.exists ? snapshot.get("count") : 0;
        if (snapshot.exists && snapshot.get("tenantId") !== context.tenantId) throw new Error("Invalid knowledge counter tenant");
        if (!Number.isInteger(count) || count < 0) throw new Error("Invalid knowledge counter");
        if (count >= 100) throw new ApiError(409, "Maximum of 100 knowledge documents reached.");
        transaction.set(counter, { tenantId: context.tenantId, count: count + 1 });
        transaction.create(doc, {
          ...parsed.data, tenantId: context.tenantId, createdBy: context.uid, createdAt: new Date().toISOString(),
        });
      });
      return res.status(201).json({ id: doc.id });
    }

    if (req.method === "DELETE") {
      const parsed = knowledgeIdSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid document ID." });
      const doc = collection.doc(parsed.data.id);
      const counter = adminDb.collection("tenants").doc(context.tenantId).collection("settings").doc("knowledge");
      await adminDb.runTransaction(async (transaction) => {
        const [snapshot, counterSnapshot] = await Promise.all([transaction.get(doc), transaction.get(counter)]);
        if (!snapshot.exists || snapshot.get("tenantId") !== context.tenantId) throw new ApiError(404, "Document not found.");
        const count = counterSnapshot.get("count");
        if (!Number.isInteger(count) || count < 1 || counterSnapshot.get("tenantId") !== context.tenantId) throw new Error("Invalid knowledge counter");
        transaction.delete(doc);
        transaction.update(counter, { count: count - 1 });
      });
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    return sendApiError(res, error, "Could not manage knowledge documents");
  }
}
