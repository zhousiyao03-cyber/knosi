import { describe, test, expect, afterEach } from "vitest";
import {
  isRerankerEnabled,
  rerankCandidates,
  __setRerankerHookForTest,
} from "./reranker";

afterEach(() => {
  __setRerankerHookForTest(null);
  delete process.env.RAG_RERANKER_ENABLED;
  delete process.env.RAG_RERANKER_MODEL;
});

describe("isRerankerEnabled", () => {
  test("default is enabled when env not set", () => {
    expect(isRerankerEnabled()).toBe(true);
  });

  test("RAG_RERANKER_ENABLED=false disables", () => {
    process.env.RAG_RERANKER_ENABLED = "false";
    expect(isRerankerEnabled()).toBe(false);
  });

  test("RAG_RERANKER_ENABLED=0 disables", () => {
    process.env.RAG_RERANKER_ENABLED = "0";
    expect(isRerankerEnabled()).toBe(false);
  });

  test("RAG_RERANKER_ENABLED=off disables", () => {
    process.env.RAG_RERANKER_ENABLED = "off";
    expect(isRerankerEnabled()).toBe(false);
  });

  test("RAG_RERANKER_ENABLED=true enables", () => {
    process.env.RAG_RERANKER_ENABLED = "true";
    expect(isRerankerEnabled()).toBe(true);
  });

  test("trims whitespace and lowercases", () => {
    process.env.RAG_RERANKER_ENABLED = "  FALSE  ";
    expect(isRerankerEnabled()).toBe(false);
  });
});

describe("rerankCandidates", () => {
  test("empty candidates returns empty without invoking model", async () => {
    let calls = 0;
    __setRerankerHookForTest(async () => {
      calls += 1;
      return [];
    });
    const result = await rerankCandidates("anything", []);
    expect(result).toEqual([]);
    expect(calls).toBe(0);
  });

  test("when disabled, returns identity passthrough with score 0", async () => {
    process.env.RAG_RERANKER_ENABLED = "false";
    let hookCalls = 0;
    __setRerankerHookForTest(async () => {
      hookCalls += 1;
      return [];
    });

    const result = await rerankCandidates("query", [
      { id: "a", text: "first" },
      { id: "b", text: "second" },
    ]);

    expect(result).toEqual([
      { id: "a", score: 0 },
      { id: "b", score: 0 },
    ]);
    // Importantly the model is not loaded when disabled — no inference cost.
    expect(hookCalls).toBe(0);
  });

  test("scores match candidate order when enabled", async () => {
    const captured: Array<[string, string]> = [];
    __setRerankerHookForTest(async (pairs) => {
      captured.push(...pairs);
      // Simulate the cross-encoder: longer text = higher score.
      return pairs.map(([, text]) => text.length);
    });

    const result = await rerankCandidates("relevant query", [
      { id: "short", text: "hi" },
      { id: "long", text: "this is a much longer text" },
      { id: "medium", text: "moderate" },
    ]);

    expect(result).toEqual([
      { id: "short", score: 2 },
      { id: "long", score: 26 },
      { id: "medium", score: 8 },
    ]);
    // Verify query was paired with each candidate text in order.
    expect(captured).toEqual([
      ["relevant query", "hi"],
      ["relevant query", "this is a much longer text"],
      ["relevant query", "moderate"],
    ]);
  });

  test("propagates hook errors so callers can fall back", async () => {
    __setRerankerHookForTest(async () => {
      throw new Error("simulated model load failure");
    });
    await expect(
      rerankCandidates("q", [{ id: "x", text: "y" }])
    ).rejects.toThrow("simulated model load failure");
  });

  test("preserves original candidate order in output", async () => {
    // Even though scores would naturally re-sort, rerankCandidates returns
    // results aligned to the input order — sorting is the caller's job.
    __setRerankerHookForTest(async (pairs) =>
      pairs.map((_, idx) => 100 - idx * 10)
    );

    const result = await rerankCandidates("q", [
      { id: "first", text: "a" },
      { id: "second", text: "b" },
      { id: "third", text: "c" },
    ]);

    expect(result.map((r) => r.id)).toEqual(["first", "second", "third"]);
    expect(result.map((r) => r.score)).toEqual([100, 90, 80]);
  });
});
