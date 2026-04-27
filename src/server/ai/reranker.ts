// Cross-encoder reranker for RAG. Takes (query, candidate) pairs and returns
// a relevance score per candidate. Used to re-sort the top-N from BM25+ANN
// fusion before truncating to FINAL_LIMIT.
//
// Why an in-process Transformers.js cross-encoder vs. an API:
//   - Zero ongoing cost (no per-call charge)
//   - Latency stays within the same Node process — no extra network hop
//   - Q8 quantization keeps the model under 25MB on disk
//   - Dockerfile pre-warms HF cache so cold start is download-free
//
// Why this is a separate module from embeddings.ts:
//   - Different pipeline kind ("text-classification" with sentence-pair input
//     vs. "feature-extraction")
//   - Different input shape (pairs of strings, not single strings)
//   - Different lifecycle (only loaded if RAG_RERANKER_ENABLED=true)

import type { TextClassificationPipeline } from "@huggingface/transformers";

export interface RerankerCandidate {
  id: string;
  text: string;
}

export interface RerankerResult {
  id: string;
  score: number;
}

const DEFAULT_MODEL_ID = "Xenova/ms-marco-MiniLM-L-6-v2";

function getModelId(): string {
  return (
    process.env.RAG_RERANKER_MODEL?.trim() ||
    process.env.TRANSFORMERS_RERANKER_MODEL?.trim() ||
    DEFAULT_MODEL_ID
  );
}

export function isRerankerEnabled(): boolean {
  // Default ON. Set RAG_RERANKER_ENABLED=false to bypass (useful for A/B eval
  // and quick rollback without redeploying).
  const raw = process.env.RAG_RERANKER_ENABLED?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off" || raw === "no") {
    return false;
  }
  return true;
}

let pipelinePromise: Promise<TextClassificationPipeline> | null = null;
let testHook: ((pairs: Array<[string, string]>) => Promise<number[]>) | null =
  null;

async function getPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      // Dynamic import for the same reason as embeddings.ts: keep cold start
      // cost lazy so the rest of the server doesn't pay for it on boot.
      const { pipeline } = await import("@huggingface/transformers");
      return pipeline("text-classification", getModelId(), {
        dtype: "q8",
      });
    })();
  }
  return pipelinePromise;
}

/**
 * Score each candidate's relevance to the query. Higher = more relevant.
 *
 * The cross-encoder takes the (query, candidate) pair as a single sequence
 * and outputs a single logit. We expose that logit raw — no normalization —
 * because callers only sort by it; absolute values are not meaningful.
 *
 * On any error (model load fail, OOM, etc.), throws — the caller decides
 * whether to fall back to the input order.
 */
export async function rerankCandidates(
  query: string,
  candidates: RerankerCandidate[]
): Promise<RerankerResult[]> {
  if (candidates.length === 0) return [];
  if (!isRerankerEnabled()) {
    // Identity passthrough when disabled — keeps caller code simple.
    return candidates.map((c) => ({ id: c.id, score: 0 }));
  }

  if (testHook) {
    const pairs = candidates.map(
      (c) => [query, c.text] as [string, string]
    );
    const scores = await testHook(pairs);
    return candidates.map((c, i) => ({ id: c.id, score: scores[i] ?? 0 }));
  }

  const pipe = await getPipeline();

  // ms-marco-MiniLM was trained with [CLS] query [SEP] passage [SEP]. The
  // Transformers.js text-classification pipeline accepts pairs as
  // { text, text_pair } and applies the right tokenization.
  const inputs = candidates.map((c) => ({
    text: query,
    text_pair: c.text,
  }));

  // Cross-encoders are batchable; the pipeline handles internal batching.
  // We pass everything in one call to maximize throughput.
  const raw = (await pipe(inputs, { topk: 1 })) as Array<
    { score: number } | Array<{ score: number }>
  >;

  // Pipeline output shape varies by topk: with topk=1 it's a flat array of
  // { label, score }. Be defensive about array-of-array fallback.
  const scores = raw.map((entry) => {
    if (Array.isArray(entry)) {
      return Number(entry[0]?.score ?? 0);
    }
    return Number(entry.score ?? 0);
  });

  return candidates.map((c, i) => ({ id: c.id, score: scores[i] ?? 0 }));
}

// ─── Test seam ─────────────────────────────────────────────────────────

export function __setRerankerHookForTest(
  hook: ((pairs: Array<[string, string]>) => Promise<number[]>) | null
) {
  testHook = hook;
  pipelinePromise = null;
}
