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

// We use the lower-level AutoTokenizer + AutoModelForSequenceClassification
// instead of the high-level pipeline("text-classification", …) because the
// pipeline's TS signature only accepts string / string[] inputs, but a
// cross-encoder needs (query, passage) pairs. The tokenizer's `text_pair`
// option is the supported way to feed pairs end-to-end.

interface RerankerModel {
  tokenizer: (
    text: string[],
    options: {
      text_pair: string[];
      padding: boolean;
      truncation: boolean;
    }
  ) => Record<string, unknown>;
  model: (input: Record<string, unknown>) => Promise<{
    logits: { data: ArrayLike<number>; dims: number[] };
  }>;
}

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

let modelPromise: Promise<RerankerModel> | null = null;
let testHook: ((pairs: Array<[string, string]>) => Promise<number[]>) | null =
  null;

async function loadModel(): Promise<RerankerModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      // Dynamic import for the same reason as embeddings.ts: keep cold start
      // cost lazy so the rest of the server doesn't pay for it on boot.
      const transformers = (await import("@huggingface/transformers")) as {
        AutoTokenizer: { from_pretrained: (id: string) => Promise<unknown> };
        AutoModelForSequenceClassification: {
          from_pretrained: (
            id: string,
            options: { dtype: string }
          ) => Promise<unknown>;
        };
      };
      const id = getModelId();
      const [tokenizer, model] = await Promise.all([
        transformers.AutoTokenizer.from_pretrained(id),
        transformers.AutoModelForSequenceClassification.from_pretrained(id, {
          dtype: "q8",
        }),
      ]);
      return {
        tokenizer: tokenizer as RerankerModel["tokenizer"],
        model: model as RerankerModel["model"],
      };
    })();
  }
  return modelPromise;
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

  const { tokenizer, model } = await loadModel();

  // Build one batch: query repeated to align with each candidate, candidates
  // as text_pair. Tokenizer handles padding + truncation internally so all
  // pairs end up the same length in the output tensor.
  const queries = candidates.map(() => query);
  const passages = candidates.map((c) => c.text);

  const inputs = tokenizer(queries, {
    text_pair: passages,
    padding: true,
    truncation: true,
  });

  // Single forward pass over the whole batch. logits shape: [batch_size, 1]
  // for ms-marco-MiniLM (single-class regression head).
  const { logits } = await model(inputs);
  const data = Array.from(logits.data);
  const numLabels = logits.dims[1] ?? 1;

  return candidates.map((c, i) => ({
    id: c.id,
    // For multi-label heads grab the first logit; for single-label it IS the
    // score. Either way, higher = more relevant.
    score: Number(data[i * numLabels] ?? 0),
  }));
}

// ─── Test seam ─────────────────────────────────────────────────────────

export function __setRerankerHookForTest(
  hook: ((pairs: Array<[string, string]>) => Promise<number[]>) | null
) {
  testHook = hook;
  modelPromise = null;
}
