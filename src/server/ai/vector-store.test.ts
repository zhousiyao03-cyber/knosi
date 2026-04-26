import { describe, test, expect, afterEach } from "vitest";
import {
  getVectorStore,
  __resetVectorStoreForTest,
  __setMilvusClientForTest,
} from "./vector-store";

afterEach(() => {
  __resetVectorStoreForTest();
  __setMilvusClientForTest(null);
  delete process.env.MILVUS_URI;
  delete process.env.MILVUS_TOKEN;
  delete process.env.MILVUS_COLLECTION;
  delete process.env.MILVUS_SEARCH_EF;
});

function setEnv() {
  process.env.MILVUS_URI = "https://test.milvus";
  process.env.MILVUS_TOKEN = "test-token";
}

interface FakeClientCalls {
  hasCollectionCalls: number;
  createCollectionCalls: number;
  createIndexCalls: number;
  loadCollectionCalls: number;
  upsertCalls: Array<number>;
  queryCalls: Array<{ filter: string; output_fields: string[] }>;
  searchCalls: Array<{ filter: string; params?: Record<string, unknown> }>;
  deleteCalls: Array<string>;
}

function makeFakeClient(
  overrides: Partial<{
    hasCollectionExists: boolean | (() => boolean);
    queryReturns: Array<Record<string, unknown>>;
    searchReturns: Array<{ chunk_id?: string; id?: string; score?: number }>;
  }> = {}
) {
  const calls: FakeClientCalls = {
    hasCollectionCalls: 0,
    createCollectionCalls: 0,
    createIndexCalls: 0,
    loadCollectionCalls: 0,
    upsertCalls: [],
    queryCalls: [],
    searchCalls: [],
    deleteCalls: [],
  };

  const client = {
    hasCollection: async () => {
      calls.hasCollectionCalls++;
      const exists =
        typeof overrides.hasCollectionExists === "function"
          ? overrides.hasCollectionExists()
          : (overrides.hasCollectionExists ?? true);
      return { value: exists };
    },
    createCollection: async () => {
      calls.createCollectionCalls++;
      return { error_code: "Success" };
    },
    createIndex: async () => {
      calls.createIndexCalls++;
      return { error_code: "Success" };
    },
    loadCollection: async () => {
      calls.loadCollectionCalls++;
      return { error_code: "Success" };
    },
    upsert: async ({ data }: { data: unknown[] }) => {
      calls.upsertCalls.push(data.length);
      return { status: { error_code: "Success" } };
    },
    query: async ({
      filter,
      output_fields,
    }: {
      filter: string;
      output_fields: string[];
    }) => {
      calls.queryCalls.push({ filter, output_fields });
      return { data: overrides.queryReturns ?? [] };
    },
    search: async ({
      filter,
      params,
    }: {
      filter: string;
      params?: Record<string, unknown>;
    }) => {
      calls.searchCalls.push({ filter, params });
      return { results: overrides.searchReturns ?? [] };
    },
    deleteEntities: async ({ filter }: { filter: string }) => {
      calls.deleteCalls.push(filter);
      return { status: { error_code: "Success" } };
    },
  };

  return { client, calls };
}

describe("getVectorStore", () => {
  test("returns null when MILVUS_URI is unset", () => {
    delete process.env.MILVUS_URI;
    delete process.env.MILVUS_TOKEN;
    expect(getVectorStore()).toBeNull();
  });

  test("returns null when MILVUS_TOKEN is unset", () => {
    process.env.MILVUS_URI = "https://test.milvus";
    delete process.env.MILVUS_TOKEN;
    expect(getVectorStore()).toBeNull();
  });

  test("returns a VectorStore instance when both env vars are set", () => {
    setEnv();
    const { client } = makeFakeClient();
    __setMilvusClientForTest(client);
    const store = getVectorStore();
    expect(store).not.toBeNull();
    expect(store?.ensureCollection).toBeTypeOf("function");
  });

  test("caches the store across calls (lazy singleton)", () => {
    setEnv();
    const { client } = makeFakeClient();
    __setMilvusClientForTest(client);
    const a = getVectorStore();
    const b = getVectorStore();
    expect(a).toBe(b);
  });
});

describe("ensureCollection", () => {
  test("creates collection + index when collection does not exist", async () => {
    setEnv();
    const { client, calls } = makeFakeClient({ hasCollectionExists: false });
    __setMilvusClientForTest(client);

    const store = getVectorStore()!;
    await store.ensureCollection();

    expect(calls.createCollectionCalls).toBe(1);
    expect(calls.createIndexCalls).toBe(1);
    expect(calls.loadCollectionCalls).toBe(1);
  });

  test("skips creation when collection already exists", async () => {
    setEnv();
    const { client, calls } = makeFakeClient({ hasCollectionExists: true });
    __setMilvusClientForTest(client);

    const store = getVectorStore()!;
    await store.ensureCollection();

    expect(calls.createCollectionCalls).toBe(0);
    expect(calls.createIndexCalls).toBe(0);
    expect(calls.loadCollectionCalls).toBe(1);
  });

  test("idempotent — second call is a no-op", async () => {
    setEnv();
    const { client, calls } = makeFakeClient({ hasCollectionExists: false });
    __setMilvusClientForTest(client);

    const store = getVectorStore()!;
    await store.ensureCollection();
    await store.ensureCollection();
    await store.ensureCollection();

    expect(calls.createCollectionCalls).toBe(1);
    expect(calls.createIndexCalls).toBe(1);
    expect(calls.loadCollectionCalls).toBe(1);
  });
});

describe("upsertChunkVectors", () => {
  test("batches over 100 records", async () => {
    setEnv();
    const { client, calls } = makeFakeClient();
    __setMilvusClientForTest(client);

    const store = getVectorStore()!;
    const records = Array.from({ length: 250 }, (_, i) => ({
      chunkId: `chunk-${i}`,
      userId: "user-1",
      sourceType: "note" as const,
      sourceId: "src-1",
      vector: new Array(384).fill(0.1),
    }));

    await store.upsertChunkVectors(records);
    expect(calls.upsertCalls).toEqual([100, 100, 50]);
  });

  test("no-op for empty input", async () => {
    setEnv();
    const { client, calls } = makeFakeClient();
    __setMilvusClientForTest(client);

    const store = getVectorStore()!;
    await store.upsertChunkVectors([]);

    expect(calls.upsertCalls).toEqual([]);
    // Should not even ensure the collection
    expect(calls.hasCollectionCalls).toBe(0);
  });
});

describe("searchSimilar", () => {
  test("builds expr with user_id only when no sourceTypes", async () => {
    setEnv();
    const { client, calls } = makeFakeClient({
      searchReturns: [
        { chunk_id: "c1", score: 0.95 },
        { chunk_id: "c2", score: 0.87 },
      ],
    });
    __setMilvusClientForTest(client);

    const store = getVectorStore()!;
    const results = await store.searchSimilar({
      userId: "user-abc",
      queryVector: new Array(384).fill(0.1),
      topK: 10,
    });

    expect(calls.searchCalls[0]?.filter).toBe('user_id == "user-abc"');
    expect(results).toEqual([
      { chunkId: "c1", score: 0.95 },
      { chunkId: "c2", score: 0.87 },
    ]);
  });

  test("includes source_type filter when sourceTypes provided", async () => {
    setEnv();
    const { client, calls } = makeFakeClient();
    __setMilvusClientForTest(client);

    const store = getVectorStore()!;
    await store.searchSimilar({
      userId: "user-1",
      queryVector: new Array(384).fill(0),
      topK: 5,
      sourceTypes: ["note"],
    });

    expect(calls.searchCalls[0]?.filter).toBe(
      'user_id == "user-1" && source_type in ["note"]'
    );
  });

  test("supports multiple sourceTypes", async () => {
    setEnv();
    const { client, calls } = makeFakeClient();
    __setMilvusClientForTest(client);

    const store = getVectorStore()!;
    await store.searchSimilar({
      userId: "user-1",
      queryVector: new Array(384).fill(0),
      topK: 5,
      sourceTypes: ["note", "bookmark"],
    });

    expect(calls.searchCalls[0]?.filter).toBe(
      'user_id == "user-1" && source_type in ["note", "bookmark"]'
    );
  });

  test("escapes double quotes and backslashes in user_id", async () => {
    setEnv();
    const { client, calls } = makeFakeClient();
    __setMilvusClientForTest(client);

    const store = getVectorStore()!;
    await store.searchSimilar({
      userId: 'evil"; drop --',
      queryVector: new Array(384).fill(0),
      topK: 5,
    });

    expect(calls.searchCalls[0]?.filter).toBe(
      'user_id == "evil\\"; drop --"'
    );
  });

  test("rejects user_id with control characters", async () => {
    setEnv();
    const { client } = makeFakeClient();
    __setMilvusClientForTest(client);

    const store = getVectorStore()!;
    await expect(
      store.searchSimilar({
        userId: "evil\nname",
        queryVector: new Array(384).fill(0),
        topK: 5,
      })
    ).rejects.toThrow("forbidden control character");
  });

  test("uses MILVUS_SEARCH_EF when set", async () => {
    setEnv();
    process.env.MILVUS_SEARCH_EF = "128";
    const { client, calls } = makeFakeClient();
    __setMilvusClientForTest(client);

    const store = getVectorStore()!;
    await store.searchSimilar({
      userId: "user-1",
      queryVector: new Array(384).fill(0),
      topK: 5,
    });

    expect(calls.searchCalls[0]?.params?.ef).toBe(128);
  });

  test("defaults ef to 64 when env unset", async () => {
    setEnv();
    const { client, calls } = makeFakeClient();
    __setMilvusClientForTest(client);

    const store = getVectorStore()!;
    await store.searchSimilar({
      userId: "user-1",
      queryVector: new Array(384).fill(0),
      topK: 5,
    });

    expect(calls.searchCalls[0]?.params?.ef).toBe(64);
  });
});

describe("existsByChunkIds", () => {
  test("returns the set of chunkIds present in Milvus", async () => {
    setEnv();
    const { client, calls } = makeFakeClient({
      queryReturns: [{ chunk_id: "c1" }, { chunk_id: "c3" }],
    });
    __setMilvusClientForTest(client);

    const store = getVectorStore()!;
    const result = await store.existsByChunkIds(["c1", "c2", "c3"]);

    expect([...result].sort()).toEqual(["c1", "c3"]);
    expect(calls.queryCalls[0]?.filter).toMatch(/^chunk_id in \[/);
    expect(calls.queryCalls[0]?.output_fields).toEqual(["chunk_id"]);
  });

  test("no-op for empty input", async () => {
    setEnv();
    const { client, calls } = makeFakeClient();
    __setMilvusClientForTest(client);

    const store = getVectorStore()!;
    const result = await store.existsByChunkIds([]);

    expect(result.size).toBe(0);
    expect(calls.queryCalls).toEqual([]);
  });
});

describe("deleteByChunkIds", () => {
  test("issues delete with chunk_id in [...] filter", async () => {
    setEnv();
    const { client, calls } = makeFakeClient();
    __setMilvusClientForTest(client);

    const store = getVectorStore()!;
    await store.deleteByChunkIds(["a", "b", "c"]);

    expect(calls.deleteCalls).toEqual(['chunk_id in ["a", "b", "c"]']);
  });

  test("no-op for empty list", async () => {
    setEnv();
    const { client, calls } = makeFakeClient();
    __setMilvusClientForTest(client);

    const store = getVectorStore()!;
    await store.deleteByChunkIds([]);

    expect(calls.deleteCalls).toEqual([]);
  });
});

describe("deleteBySource", () => {
  test("issues delete with source_id == filter", async () => {
    setEnv();
    const { client, calls } = makeFakeClient();
    __setMilvusClientForTest(client);

    const store = getVectorStore()!;
    await store.deleteBySource("source-123");

    expect(calls.deleteCalls).toEqual(['source_id == "source-123"']);
  });
});
