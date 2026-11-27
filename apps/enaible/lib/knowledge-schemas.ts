import { z } from "zod";

export const knowledgeDocumentSchema = z.object({
  title: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(20000),
}).strict();

export const knowledgeIdSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
}).strict();

export const knowledgeSearchSchema = z.object({
  query: z.string().trim().min(1).max(500),
}).strict();

export type KnowledgeDocument = z.infer<typeof knowledgeDocumentSchema> & {
  id: string;
};

export function searchKnowledge(
  documents: KnowledgeDocument[],
  query: string
) {
  const terms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || [])];
  if (!terms.length) return [];

  return documents
    .map((document) => {
      const lower = `${document.title} ${document.text}`.toLowerCase();
      const matched = terms.filter((term) => lower.includes(term));
      const firstMatch = Math.max(0, document.text.toLowerCase().indexOf(matched[0] || ""));
      return {
        id: document.id,
        title: document.title,
        excerpt: document.text.slice(Math.max(0, firstMatch - 300), firstMatch + 1200),
        score: matched.length,
      };
    })
    .filter((document) => document.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 5)
    .map(({ score: _score, ...document }) => document);
}
