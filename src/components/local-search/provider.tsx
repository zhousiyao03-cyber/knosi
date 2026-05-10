"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { trpc } from "@/lib/trpc";
import { readCached, writeCached, clearCached, type CachedIndex } from "./idb-cache";

/** Shape of one row from `notes.dumpForIndex`. */
type DumpedNote = {
  id: string;
  title: string;
  plainText: string;
  updatedAt: Date | null;
};

/**
 * Public hit shape returned by `search()`. Mirrors the wasm output but is
 * narrowed to what the UI needs.
 */
export type LocalSearchHit = {
  /** The note's `id`. */
  id: string;
  /** Original title (we ship it from the dump for snippet/preview rendering). */
  title: string;
  /** BM25 score; only meaningful within a single result set. */
  score: number;
  /** Optional snippet around the match, with byte ranges into `text` already
   *  translated into UTF-16 code units (see wasm bindings). */
  snippet: { text: string; highlights: Array<[number, number]> } | null;
};

type Status = "idle" | "loading" | "ready" | "error";

type Engine = {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  addDocument: (id: string, text: string) => void;
  search: (query: string, topK: number, corpus: Record<string, string>) => any[];
  toBytes: () => Uint8Array;
  docCount: () => number;
  termCount: () => number;
  /* eslint-enable @typescript-eslint/no-explicit-any */
};

type LocalSearchContext = {
  status: Status;
  /** The number of indexed docs (0 until ready). */
  docCount: number;
  /** Last error message, if any. */
  error: string | null;
  /** Run a search. Returns [] when status !== "ready". */
  search: (query: string, topK?: number) => LocalSearchHit[];
  /** Force-rebuild the index from the server. */
  rebuild: () => Promise<void>;
  /** Wipe the cached index so the next mount starts fresh. */
  reset: () => Promise<void>;
};

const Ctx = createContext<LocalSearchContext | null>(null);

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Load the wasm-bindgen ES module from `/wasm/minisearch_rs.js`. We pass a
 * runtime variable (not a string literal) to `import()` so webpack/turbopack
 * cannot try to resolve it at build time and instead forwards it to the
 * browser's native dynamic import — which fetches our static asset.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
async function loadWasmModule(): Promise<any> {
  const url = "/wasm/minisearch_rs.js";
  // The Function indirection is the most reliable way to keep both webpack
  // and turbopack from rewriting the call. The returned module is a normal
  // ES module record.
  const dynamicImport = new Function("u", "return import(u)") as (
    u: string
  ) => Promise<any>;
  return dynamicImport(url);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function LocalSearchProvider({
  /**
   * Whether the feature is enabled. Wire to a user preference; when `false`,
   * the provider stays in `idle` and never loads wasm.
   */
  enabled,
  /** Stable per-user key, e.g. the userId. */
  userKey,
  children,
}: {
  enabled: boolean;
  userKey: string;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [docCount, setDocCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const engineRef = useRef<Engine | null>(null);
  const corpusRef = useRef<Record<string, string>>({});
  const titlesRef = useRef<Record<string, string>>({});
  const utils = trpc.useUtils();

  /**
   * Build a fresh engine from a list of documents.
   * Returns the wasm engine so the caller can persist its bytes.
   */
  const buildEngine = useCallback(
    async (
      docs: Array<{ id: string; title: string; plainText: string; updatedAt: Date | null }>
    ) => {
      const wasmModule = await loadWasmModule();
      await wasmModule.default("/wasm/minisearch_rs_bg.wasm");
      const engine: Engine = new wasmModule.JsEngine();

      const corpus: Record<string, string> = {};
      const titles: Record<string, string> = {};
      let freshAs = 0;
      for (const d of docs) {
        // We index title + plainText so a query that matches only the title
        // still ranks. The title gets repeated for a small boost.
        const indexBody = `${d.title}\n${d.title}\n${d.plainText}`;
        engine.addDocument(d.id, indexBody);
        // Snippets are sourced from the original text only — duplicating the
        // title in the index is fine, but we don't want it appearing twice in
        // the preview.
        corpus[d.id] = d.plainText || d.title;
        titles[d.id] = d.title;
        const ts = d.updatedAt ? d.updatedAt.getTime() : 0;
        if (ts > freshAs) freshAs = ts;
      }
      corpusRef.current = corpus;
      titlesRef.current = titles;
      return { engine, freshAs };
    },
    []
  );

  const restoreFromCache = useCallback(
    async (cached: CachedIndex, dump: DumpedNote[]) => {
      const wasmModule = await loadWasmModule();
      await wasmModule.default("/wasm/minisearch_rs_bg.wasm");
      const engine: Engine = wasmModule.JsEngine.fromBytes(cached.bytes);
      const corpus: Record<string, string> = {};
      const titles: Record<string, string> = {};
      for (const d of dump) {
        corpus[d.id] = d.plainText || d.title;
        titles[d.id] = d.title;
      }
      corpusRef.current = corpus;
      titlesRef.current = titles;
      return engine;
    },
    []
  );

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const dump = await utils.notes.dumpForIndex.fetch();
      const cached = await readCached(userKey);
      const newestUpdatedAt = dump.reduce<number>(
        (max, d) => {
          const ts = d.updatedAt ? d.updatedAt.getTime() : 0;
          return ts > max ? ts : max;
        },
        0
      );

      // Reuse the cached index when it covers every note we just dumped and
      // nothing has been edited since. Falling back to a full rebuild on a
      // mismatch keeps the code simple at the cost of one rebuild after any
      // edit — fine for a 100-1000 note corpus.
      const cacheUsable =
        cached &&
        cached.docCount === dump.length &&
        cached.freshAs >= newestUpdatedAt &&
        Date.now() - cached.builtAt < 7 * ONE_DAY_MS;

      let engine: Engine;
      let freshAs: number;
      if (cacheUsable && cached) {
        engine = await restoreFromCache(cached, dump);
        freshAs = cached.freshAs;
      } else {
        const built = await buildEngine(dump);
        engine = built.engine;
        freshAs = built.freshAs;
        await writeCached(userKey, {
          bytes: engine.toBytes(),
          builtAt: Date.now(),
          freshAs,
          docCount: dump.length,
        });
      }
      engineRef.current = engine;
      setDocCount(engine.docCount());
      setStatus("ready");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[local-search] load failed", e);
      setError(msg);
      setStatus("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- utils is stable per-trpc-client
  }, [buildEngine, restoreFromCache, userKey]);

  useEffect(() => {
    if (!enabled) {
      engineRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- effect drives external (wasm) state, not pure render
      setStatus("idle");
      setDocCount(0);
      return;
    }
    if (status === "idle" || status === "error") {
      void load();
    }
    // The deps are intentional: we only kick off a load when `enabled` flips
    // on. `status` stays out of the deps to avoid an infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const search = useCallback<LocalSearchContext["search"]>(
    (query, topK = 10) => {
      const eng = engineRef.current;
      if (!eng || status !== "ready" || !query.trim()) return [];
      try {
        const raw = eng.search(query, topK, corpusRef.current);
        return raw.map((h: { doc_id: string; score: number; snippet: LocalSearchHit["snippet"] }) => ({
          id: h.doc_id,
          title: titlesRef.current[h.doc_id] ?? h.doc_id,
          score: h.score,
          snippet: h.snippet,
        }));
      } catch (e) {
        console.error("[local-search] search threw", e);
        return [];
      }
    },
    [status]
  );

  const rebuild = useCallback(async () => {
    await clearCached(userKey);
    await load();
  }, [load, userKey]);

  const reset = useCallback(async () => {
    await clearCached(userKey);
    engineRef.current = null;
    setDocCount(0);
    setStatus("idle");
  }, [userKey]);

  const value = useMemo<LocalSearchContext>(
    () => ({ status, docCount, error, search, rebuild, reset }),
    [status, docCount, error, search, rebuild, reset]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocalSearch(): LocalSearchContext {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // The provider isn't mounted (feature disabled / no auth context).
    // Return a no-op shape so callers don't have to null-check.
    return {
      status: "idle",
      docCount: 0,
      error: null,
      search: () => [],
      rebuild: async () => {},
      reset: async () => {},
    };
  }
  return ctx;
}
