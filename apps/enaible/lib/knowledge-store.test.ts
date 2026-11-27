import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collection: vi.fn(),
  doc: vi.fn(),
  subcollection: vi.fn(),
  limit: vi.fn(),
  get: vi.fn(),
}));

vi.mock("./server-auth", () => ({
  adminDb: { collection: mocks.collection },
  ApiError: class ApiError extends Error {
    constructor(public statusCode: number, message: string) { super(message); }
  },
}));

import { findKnowledge, listKnowledge } from "./knowledge-store";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.collection.mockReturnValue({ doc: mocks.doc });
  mocks.doc.mockReturnValue({ collection: mocks.subcollection });
  mocks.subcollection.mockReturnValue({ limit: mocks.limit });
  mocks.limit.mockReturnValue({ get: mocks.get });
});

describe("tenant knowledge store", () => {
  it("retrieves only from the requested tenant collection", async () => {
    mocks.get.mockResolvedValue({
      size: 1,
      docs: [{ id: "doc1", data: () => ({ tenantId: "tenant-a", title: "Exercises", text: "Goblet squats" }) }],
    });
    expect(await findKnowledge("tenant-a", "goblet")).toHaveLength(1);
    expect(mocks.collection).toHaveBeenCalledWith("tenants");
    expect(mocks.doc).toHaveBeenCalledWith("tenant-a");
    expect(mocks.subcollection).toHaveBeenCalledWith("knowledge");
  });

  it("fails closed on a document with another tenant ID", async () => {
    mocks.get.mockResolvedValue({
      size: 1,
      docs: [{ id: "doc1", ref: { path: "tenants/tenant-a/knowledge/doc1" }, data: () => ({ tenantId: "tenant-b", title: "Private", text: "Secret" }) }],
    });
    await expect(listKnowledge("tenant-a")).rejects.toThrow("Invalid knowledge record");
  });

  it("fails closed instead of silently truncating too many documents", async () => {
    mocks.get.mockResolvedValue({ size: 101, docs: [] });
    await expect(listKnowledge("tenant-a")).rejects.toThrow("Knowledge limit exceeded");
  });
});
