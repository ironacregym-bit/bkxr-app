import { adminDb, ApiError } from "./server-auth";
import {
  knowledgeDocumentSchema,
  searchKnowledge,
  type KnowledgeDocument,
} from "./knowledge-schemas";

export async function listKnowledge(tenantId: string): Promise<KnowledgeDocument[]> {
  const snapshot = await adminDb.collection("tenants").doc(tenantId)
    .collection("knowledge").limit(101).get();
  if (snapshot.size > 100) {
    throw new ApiError(409, "Knowledge limit exceeded; remove documents before searching.");
  }
  return snapshot.docs.map((document) => {
    const data = document.data();
    const parsed = knowledgeDocumentSchema.safeParse({ title: data.title, text: data.text });
    if (data.tenantId !== tenantId || !parsed.success) {
      throw new Error(`Invalid knowledge record: ${document.ref.path}`);
    }
    return { id: document.id, ...parsed.data };
  });
}

export async function findKnowledge(tenantId: string, query: string) {
  return searchKnowledge(await listKnowledge(tenantId), query);
}
