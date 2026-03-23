export const TOKEN_USAGE_PROVIDERS = [
  "codex",
  "claude-code",
  "openai-api",
  "other",
] as const;

export type TokenUsageProvider = (typeof TOKEN_USAGE_PROVIDERS)[number];

export const TOKEN_USAGE_ENTRY_SOURCES = [
  "manual",
  "import",
  "local-codex",
  "local-claude-code",
] as const;

export type TokenUsageEntrySource = (typeof TOKEN_USAGE_ENTRY_SOURCES)[number];

export const TOKEN_USAGE_PROVIDER_LABELS: Record<TokenUsageProvider, string> = {
  codex: "Codex",
  "claude-code": "Claude Code",
  "openai-api": "OpenAI API",
  other: "Other",
};

export const TOKEN_USAGE_ENTRY_SOURCE_LABELS: Record<TokenUsageEntrySource, string> = {
  manual: "手动记录",
  import: "导入记录",
  "local-codex": "Codex 本地读取",
  "local-claude-code": "Claude Code 本地读取",
};

export const TOKEN_USAGE_PROVIDER_OPTIONS = TOKEN_USAGE_PROVIDERS.map(
  (provider) => ({
    value: provider,
    label: TOKEN_USAGE_PROVIDER_LABELS[provider],
  })
);

type DateLike = Date | string | number | null | undefined;

export interface TokenUsageEntryMetrics {
  provider: TokenUsageProvider | null;
  totalTokens?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedTokens?: number | null;
  usageAt?: DateLike;
}

export interface TokenUsageBreakdown {
  provider: TokenUsageProvider;
  totalTokens: number;
  entryCount: number;
  share: number;
}

export interface TokenUsageListEntry extends TokenUsageEntryMetrics {
  id: string;
  provider: TokenUsageProvider;
  model: string | null;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  notes: string | null;
  source: TokenUsageEntrySource;
  usageAt: Date;
  canDelete: boolean;
}

export interface TokenUsageLocalSourceStatus {
  provider: Extract<TokenUsageProvider, "codex" | "claude-code">;
  label: string;
  source: Extract<TokenUsageEntrySource, "local-codex" | "local-claude-code">;
  status: "connected" | "missing" | "error";
  location: string | null;
  entryCount: number;
  detail: string | null;
}

export interface TokenUsageListResponse {
  entries: TokenUsageListEntry[];
  localSources: TokenUsageLocalSourceStatus[];
}

export interface TokenUsageSummary<T extends TokenUsageEntryMetrics> {
  totals: {
    allTimeTokens: number;
    thisMonthTokens: number;
    last7DaysTokens: number;
    inputTokens: number;
    outputTokens: number;
    cachedTokens: number;
    entryCount: number;
    providerCount: number;
  };
  providerBreakdown: TokenUsageBreakdown[];
  recentEntries: T[];
}

const tokenFormatter = new Intl.NumberFormat("en-US");
const compactTokenFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function normalizeTokenValue(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value ?? 0));
}

function toUsageTimestamp(value: DateLike) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

export function calculateTotalTokens(entry: {
  totalTokens?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedTokens?: number | null;
}) {
  if (entry.totalTokens != null && Number.isFinite(entry.totalTokens)) {
    return normalizeTokenValue(entry.totalTokens);
  }

  return (
    normalizeTokenValue(entry.inputTokens) +
    normalizeTokenValue(entry.outputTokens) +
    normalizeTokenValue(entry.cachedTokens)
  );
}

export function getTokenUsageProviderLabel(provider: TokenUsageProvider | null) {
  if (!provider) return "Unknown";
  return TOKEN_USAGE_PROVIDER_LABELS[provider];
}

export function getTokenUsageEntrySourceLabel(source: TokenUsageEntrySource) {
  return TOKEN_USAGE_ENTRY_SOURCE_LABELS[source];
}

export function isPersistedTokenUsageSource(source: TokenUsageEntrySource) {
  return source === "manual" || source === "import";
}

export function formatTokenCount(value: number) {
  return tokenFormatter.format(Math.max(0, Math.trunc(value)));
}

export function formatCompactTokenCount(value: number) {
  const normalized = Math.max(0, Math.trunc(value));
  if (normalized < 1000) {
    return formatTokenCount(normalized);
  }

  return compactTokenFormatter.format(normalized);
}

export function summarizeTokenUsageEntries<T extends TokenUsageEntryMetrics>(
  entries: T[]
): TokenUsageSummary<T> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const last7DaysStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 6
  ).getTime();

  let allTimeTokens = 0;
  let thisMonthTokens = 0;
  let last7DaysTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;
  const breakdownMap = new Map<TokenUsageProvider, { totalTokens: number; entryCount: number }>();

  for (const entry of entries) {
    const totalTokens = calculateTotalTokens(entry);
    const input = normalizeTokenValue(entry.inputTokens);
    const output = normalizeTokenValue(entry.outputTokens);
    const cached = normalizeTokenValue(entry.cachedTokens);
    const usageTimestamp = toUsageTimestamp(entry.usageAt);

    allTimeTokens += totalTokens;
    inputTokens += input;
    outputTokens += output;
    cachedTokens += cached;

    if (usageTimestamp >= monthStart) {
      thisMonthTokens += totalTokens;
    }

    if (usageTimestamp >= last7DaysStart) {
      last7DaysTokens += totalTokens;
    }

    if (entry.provider) {
      const providerTotals = breakdownMap.get(entry.provider) ?? {
        totalTokens: 0,
        entryCount: 0,
      };

      providerTotals.totalTokens += totalTokens;
      providerTotals.entryCount += 1;
      breakdownMap.set(entry.provider, providerTotals);
    }
  }

  const providerBreakdown = [...breakdownMap.entries()]
    .map(([provider, providerTotals]) => ({
      provider,
      totalTokens: providerTotals.totalTokens,
      entryCount: providerTotals.entryCount,
      share:
        allTimeTokens > 0 ? providerTotals.totalTokens / allTimeTokens : 0,
    }))
    .sort((left, right) => right.totalTokens - left.totalTokens);

  const recentEntries = [...entries].sort((left, right) => {
    return toUsageTimestamp(right.usageAt) - toUsageTimestamp(left.usageAt);
  });

  return {
    totals: {
      allTimeTokens,
      thisMonthTokens,
      last7DaysTokens,
      inputTokens,
      outputTokens,
      cachedTokens,
      entryCount: entries.length,
      providerCount: providerBreakdown.length,
    },
    providerBreakdown,
    recentEntries,
  };
}
