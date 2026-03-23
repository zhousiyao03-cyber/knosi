import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { homedir } from "os";
import path from "path";
import Database from "better-sqlite3";
import {
  calculateTotalTokens,
  type TokenUsageListEntry,
  type TokenUsageLocalSourceStatus,
} from "@/lib/token-usage";

type CodexThreadRow = {
  id: string;
  title: string;
  model: string | null;
  cwd: string;
  tokensUsed: number;
  updatedAt: number;
};

const workspaceRoot = process.cwd();
const homeDirectory = homedir();

function normalizeTokenValue(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function sortEntriesByUsageDate(entries: TokenUsageListEntry[]) {
  return entries.toSorted((left, right) => {
    return new Date(right.usageAt ?? 0).getTime() - new Date(left.usageAt ?? 0).getTime();
  });
}

function toWorkspacePrefix(value: string) {
  return `${value}${value.endsWith(path.sep) ? "" : path.sep}%`;
}

function encodeClaudeProjectDirectoryName(value: string) {
  return value.replaceAll(/[\\/]+/g, "-");
}

function resolveCodexStateDatabasePath() {
  const codexDirectory = path.join(homeDirectory, ".codex");
  if (!existsSync(codexDirectory)) {
    return null;
  }

  const candidates = readdirSync(codexDirectory)
    .filter((name) => /^state(?:_\d+)?\.sqlite$/.test(name))
    .map((name) => {
      const absolutePath = path.join(codexDirectory, name);
      return {
        path: absolutePath,
        mtimeMs: statSync(absolutePath).mtimeMs,
      };
    })
    .toSorted((left, right) => right.mtimeMs - left.mtimeMs);

  return candidates[0]?.path ?? null;
}

function readCodexWorkspaceEntries() {
  const dbPath = resolveCodexStateDatabasePath();
  if (!dbPath) {
    return {
      entries: [] as TokenUsageListEntry[],
      source: {
        provider: "codex",
        label: "Codex",
        source: "local-codex",
        status: "missing",
        location: path.join(homeDirectory, ".codex"),
        entryCount: 0,
        detail: "没有找到 Codex 本地状态库。",
      } satisfies TokenUsageLocalSourceStatus,
    };
  }

  let sqlite: Database.Database | null = null;

  try {
    sqlite = new Database(dbPath, { readonly: true, fileMustExist: true });
    const rows = sqlite
      .prepare(
        `
          select
            id,
            title,
            model,
            cwd,
            tokens_used as tokensUsed,
            updated_at as updatedAt
          from threads
          where tokens_used > 0
            and (cwd = ? or cwd like ?)
          order by updated_at desc
        `
      )
      .all(workspaceRoot, toWorkspacePrefix(workspaceRoot)) as CodexThreadRow[];

    const entries = rows.map((row) => ({
      id: `local:codex:${row.id}`,
      provider: "codex" as const,
      model: row.model ?? null,
      totalTokens: normalizeTokenValue(row.tokensUsed),
      inputTokens: 0,
      outputTokens: 0,
      cachedTokens: 0,
      notes: row.title || row.cwd,
      source: "local-codex" as const,
      usageAt: new Date(normalizeTokenValue(row.updatedAt) * 1000),
      canDelete: false,
    }));

    return {
      entries,
      source: {
        provider: "codex",
        label: "Codex",
        source: "local-codex",
        status: "connected",
        location: dbPath,
        entryCount: entries.length,
        detail:
          entries.length > 0
            ? `已读取当前工作区的 ${entries.length} 条 Codex session。`
            : "当前工作区还没有读到 Codex session。",
      } satisfies TokenUsageLocalSourceStatus,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "读取 Codex 本地状态库失败。";

    return {
      entries: [] as TokenUsageListEntry[],
      source: {
        provider: "codex",
        label: "Codex",
        source: "local-codex",
        status: "error",
        location: dbPath,
        entryCount: 0,
        detail,
      } satisfies TokenUsageLocalSourceStatus,
    };
  } finally {
    sqlite?.close();
  }
}

function readClaudeSessionEntry(filePath: string): TokenUsageListEntry | null {
  const rawContent = readFileSync(filePath, "utf8");
  const lines = rawContent.split(/\r?\n/);
  const fileName = path.basename(filePath, ".jsonl");
  const fallbackTimestamp = statSync(filePath).mtimeMs;

  let belongsToWorkspace = false;
  let latestTimestamp = fallbackTimestamp;
  let cwd: string | null = null;
  let model: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;

  for (const line of lines) {
    if (!line.trim()) continue;

    try {
      const item = JSON.parse(line) as {
        cwd?: unknown;
        timestamp?: unknown;
        message?: {
          model?: unknown;
          usage?: {
            input_tokens?: unknown;
            output_tokens?: unknown;
            cache_creation_input_tokens?: unknown;
            cache_read_input_tokens?: unknown;
          };
        };
      };

      if (typeof item.cwd === "string" && item.cwd.length > 0) {
        cwd = item.cwd;
        if (item.cwd === workspaceRoot || item.cwd.startsWith(`${workspaceRoot}${path.sep}`)) {
          belongsToWorkspace = true;
        }
      }

      if (typeof item.timestamp === "string") {
        const timestamp = Date.parse(item.timestamp);
        if (Number.isFinite(timestamp)) {
          latestTimestamp = Math.max(latestTimestamp, timestamp);
        }
      }

      if (typeof item.message?.model === "string" && item.message.model.length > 0) {
        model = item.message.model;
      }

      const usage = item.message?.usage;
      if (!usage) continue;

      inputTokens += normalizeTokenValue(usage.input_tokens);
      outputTokens += normalizeTokenValue(usage.output_tokens);
      cachedTokens +=
        normalizeTokenValue(usage.cache_creation_input_tokens) +
        normalizeTokenValue(usage.cache_read_input_tokens);
    } catch {
      continue;
    }
  }

  if (!belongsToWorkspace) {
    return null;
  }

  const totalTokens = calculateTotalTokens({
    inputTokens,
    outputTokens,
    cachedTokens,
  });

  if (totalTokens <= 0) {
    return null;
  }

  return {
    id: `local:claude-code:${fileName}`,
    provider: "claude-code",
    model,
    totalTokens,
    inputTokens,
    outputTokens,
    cachedTokens,
    notes: cwd ? `Workspace: ${cwd}` : `Claude Code session ${fileName.slice(0, 8)}`,
    source: "local-claude-code",
    usageAt: new Date(latestTimestamp),
    canDelete: false,
  };
}

function readClaudeWorkspaceEntries() {
  const claudeProjectDirectory = path.join(
    homeDirectory,
    ".claude",
    "projects",
    encodeClaudeProjectDirectoryName(workspaceRoot)
  );

  if (!existsSync(claudeProjectDirectory)) {
    return {
      entries: [] as TokenUsageListEntry[],
      source: {
        provider: "claude-code",
        label: "Claude Code",
        source: "local-claude-code",
        status: "missing",
        location: claudeProjectDirectory,
        entryCount: 0,
        detail: "没有找到当前工作区的 Claude Code session 目录。",
      } satisfies TokenUsageLocalSourceStatus,
    };
  }

  try {
    const entries = readdirSync(claudeProjectDirectory)
      .filter((name) => name.endsWith(".jsonl") && name !== "sessions-index.json")
      .map((name) => readClaudeSessionEntry(path.join(claudeProjectDirectory, name)))
      .filter((entry): entry is TokenUsageListEntry => entry != null);

    return {
      entries,
      source: {
        provider: "claude-code",
        label: "Claude Code",
        source: "local-claude-code",
        status: "connected",
        location: claudeProjectDirectory,
        entryCount: entries.length,
        detail:
          entries.length > 0
            ? `已聚合当前工作区的 ${entries.length} 个 Claude Code session。`
            : "当前工作区还没有读到 Claude Code session。",
      } satisfies TokenUsageLocalSourceStatus,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "读取 Claude Code 本地 session 失败。";

    return {
      entries: [] as TokenUsageListEntry[],
      source: {
        provider: "claude-code",
        label: "Claude Code",
        source: "local-claude-code",
        status: "error",
        location: claudeProjectDirectory,
        entryCount: 0,
        detail,
      } satisfies TokenUsageLocalSourceStatus,
    };
  }
}

export function readWorkspaceLocalTokenUsage() {
  const codex = readCodexWorkspaceEntries();
  const claude = readClaudeWorkspaceEntries();

  return {
    entries: sortEntriesByUsageDate([...codex.entries, ...claude.entries]),
    localSources: [codex.source, claude.source],
  };
}
