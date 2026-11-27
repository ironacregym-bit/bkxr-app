import { describe, expect, it } from "vitest";
import { knowledgeDocumentSchema, searchKnowledge } from "./knowledge-schemas";

describe("knowledge input and retrieval", () => {
  it("rejects empty, oversized and unexpected document fields", () => {
    expect(knowledgeDocumentSchema.safeParse({ title: " ", text: "hello" }).success).toBe(false);
    expect(knowledgeDocumentSchema.safeParse({ title: "Title", text: "x".repeat(20001) }).success).toBe(false);
    expect(knowledgeDocumentSchema.safeParse({ title: "Title", text: "hello", tenantId: "other" }).success).toBe(false);
  });

  it("returns matching excerpts and no results for unrelated or short queries", () => {
    const docs = [
      { id: "1", title: "Exercises", text: "Goblet squats use a kettlebell." },
      { id: "2", title: "Equipment", text: "Two rowing machines." },
    ];
    expect(searchKnowledge(docs, "kettlebell").map((d) => d.id)).toEqual(["1"]);
    expect(searchKnowledge(docs, "barbell")).toEqual([]);
    expect(searchKnowledge(docs, "a b")).toEqual([]);
  });
});
