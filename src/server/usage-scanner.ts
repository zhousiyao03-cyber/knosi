import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { homedir } from "os";
import path from "path";
import type { UsageRecord } from "@/lib/usage-utils";

const homeDirectory = homedir();
const claudeProjectsRoot = path.join(homeDirectory, ".claude", "projects");
const CACHE_TTL_MS = 10_000;

let cache: { expiresAt: number; value: UsageRecord[] } | null = null;

function normalizeTokenValue(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function toDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Aggregation map: (date, provider, model) → cumulative tokens
// ---------------------------------------------------------------------------

type AggKey = string; // "date|provider|model"

function aggKey(date: string, provider: string, model: string): AggKey {
  return `${date}|${provider}|${model}`;
}

function mergeInto(
  map: Map<AggKey, UsageRecord>,
  date: string,
  provider: string,
  model: string,
  input: number,
  output: number,
  cacheRead: number,
  cacheWrite: number,
) {
  const key = aggKey(date, provider, model);
  const existing = map.get(key);
  if (existing) {
    existing.input_tokens += input;
    existing.output_tokens += output;
    existing.cache_read_tokens += cacheRead;
    existing.cache_write_tokens += cacheWrite;
  } else {
    map.set(key, {
      date,
      provider,
      model,
      input_tokens: input,
      output_tokens: output,
      cache_read_tokens: cacheRead,
      cache_write_tokens: cacheWrite,
    });
  }
}

// ---------------------------------------------------------------------------
// Claude Code scanner
// ---------------------------------------------------------------------------

function listJsonlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJsonlFiles(absolutePath);
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) return [];
    return [absolutePath];
  });
}

function scanClaudeLogs(map: Map<AggKey, UsageRecord>) {
  if (!existsSync(claudeProjectsRoot)) return;

  const files = listJsonlFiles(claudeProjectsRoot);
  for (const filePath of files) {
    try {
      const raw = readFileSync(filePath, "utf8");
      const lines = raw.split(/\r?\n/);
      const fallbackTs = statSync(filePath).mtimeMs;

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const item = JSON.parse(line) as {
            timestamp?: string;
            message?: {
              model?: string;
              usage?: {
                input_tokens?: unknown;
                output_tokens?: unknown;
                cache_creation_input_tokens?: unknown;
                cache_read_input_tokens?: unknown;
              };
            };
          };

          const usage = item.message?.usage;
          if (!usage) continue;

          const inputTokens = normalizeTokenValue(usage.input_tokens);
          const outputTokens = normalizeTokenValue(usage.output_tokens);
          const cacheRead = normalizeTokenValue(usage.cache_read_input_tokens);
          const cacheWrite = normalizeTokenValue(usage.cache_creation_input_tokens);

          if (inputTokens + outputTokens + cacheRead + cacheWrite === 0) continue;

          const ts = item.timestamp ? Date.parse(item.timestamp) : fallbackTs;
          const date = toDateKey(Number.isFinite(ts) ? ts : fallbackTs);
          let model = item.message?.model ?? "unknown";
          // Strip "anthropic." prefix if present
          if (model.startsWith("anthropic.")) model = model.slice(10);

          mergeInto(map, date, "claude-code", model, inputTokens, outputTokens, cacheRead, cacheWrite);
        } catch {
          continue;
        }
      }
    } catch {
      continue;
    }
  }
}

// ---------------------------------------------------------------------------
// Codex scanner (reads SQLite if available)
// ---------------------------------------------------------------------------

type CodexThreadRow = {
  id: string;
  model: string | null;
  tokensUsed: number;
  updatedAt: number;
};

type BetterSqlite3Statement<Row> = { all(): Row[] };
type BetterSqlite3Database<Row> = {
  prepare(sql: string): BetterSqlite3Statement<Row>;
  close(): void;
};
type BetterSqlite3Constructor<Row> = new (
  filePath: string,
  options: { readonly: boolean; fileMustExist: boolean }
) => BetterSqlite3Database<Row>;

function tryRequireBetterSqlite3(): BetterSqlite3Constructor<CodexThreadRow> | null {
  try {
    const runtimeRequire = new Function("specifier", "return require(specifier);") as (
      specifier: string,
    ) => unknown;
    const loadedModule = runtimeRequire("better-sqlite3");
    return typeof loadedModule === "function"
      ? (loadedModule as BetterSqlite3Constructor<CodexThreadRow>)
      : null;
  } catch {
    return null;
  }
}

function resolveCodexDbPath(): string | null {
  const codexDir = path.join(homeDirectory, ".codex");
  if (!existsSync(codexDir)) return null;

  const candidates = readdirSync(codexDir)
    .filter((name) => /^state(?:_\d+)?\.sqlite$/.test(name))
    .map((name) => {
      const p = path.join(codexDir, name);
      return { path: p, mtimeMs: statSync(p).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return candidates[0]?.path ?? null;
}

function scanCodexLogs(map: Map<AggKey, UsageRecord>) {
  const dbPath = resolveCodexDbPath();
  if (!dbPath) return;

  const Database = tryRequireBetterSqlite3();
  if (!Database) return;

  let sqlite: BetterSqlite3Database<CodexThreadRow> | null = null;
  try {
    sqlite = new Database(dbPath, { readonly: true, fileMustExist: true });
    const rows = sqlite
      .prepare(
        `SELECT id, model, tokens_used as tokensUsed, updated_at as updatedAt
         FROM threads WHERE tokens_used > 0 ORDER BY updated_at DESC`,
      )
      .all();

    for (const row of rows) {
      const date = toDateKey(normalizeTokenValue(row.updatedAt) * 1000);
      const model = row.model ?? "unknown";
      // Codex only gives total tokens; put them all as output
      mergeInto(map, date, "codex", model, 0, normalizeTokenValue(row.tokensUsed), 0, 0);
    }
  } catch {
    // Silently ignore
  } finally {
    sqlite?.close();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function scanLocalUsage(): UsageRecord[] {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.value;
  }

  const map = new Map<AggKey, UsageRecord>();
  scanClaudeLogs(map);
  scanCodexLogs(map);

  const records = [...map.values()].sort((a, b) => b.date.localeCompare(a.date));

  cache = { expiresAt: Date.now() + CACHE_TTL_MS, value: records };
  return records;
}
