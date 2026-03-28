"use client";

import { useDeferredValue, useState } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bot,
  Clock3,
  HardDrive,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import {
  calculateTotalTokens,
  formatCompactTokenCount,
  formatTokenCount,
  getTokenUsageEntrySourceLabel,
  getTokenUsageProviderLabel,
  isPersistedTokenUsageSource,
  summarizeTokenUsageEntries,
  TOKEN_USAGE_AUTO_REFRESH_INTERVAL_MS,
  TOKEN_USAGE_PROVIDER_OPTIONS,
  type TokenUsageProvider,
} from "@/lib/token-usage";
import { cn, formatDate, truncateText } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

type UsageFormState = {
  provider: TokenUsageProvider;
  model: string;
  totalTokens: string;
  inputTokens: string;
  outputTokens: string;
  cachedTokens: string;
  usageAt: string;
  notes: string;
};

const providerTone: Record<TokenUsageProvider, string> = {
  codex:
    "border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/50 dark:text-sky-300",
  "claude-code":
    "border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/70 dark:bg-violet-950/50 dark:text-violet-300",
  "openai-api":
    "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-300",
  other:
    "border border-stone-200 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300",
};

function toLocalDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function createInitialFormState(): UsageFormState {
  return {
    provider: "codex",
    model: "",
    totalTokens: "",
    inputTokens: "",
    outputTokens: "",
    cachedTokens: "",
    usageAt: toLocalDateTimeValue(new Date()),
    notes: "",
  };
}

function parseNumberInput(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.trunc(parsed));
}

export default function TokenUsagePage() {
  const [showForm, setShowForm] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [providerFilter, setProviderFilter] = useState<"all" | TokenUsageProvider>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState<UsageFormState>(() => createInitialFormState());
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const {
    data,
    isLoading,
    refetch,
  } = trpc.tokenUsage.list.useQuery(undefined, {
    refetchInterval: TOKEN_USAGE_AUTO_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  const entries = data?.entries ?? [];
  const localSources = data?.localSources ?? [];

  const createUsage = trpc.tokenUsage.create.useMutation({
    onSuccess: ({ totalTokens }) => {
      void utils.tokenUsage.invalidate();
      toast(`已记录 ${formatTokenCount(totalTokens)} tokens`, "success");
      setForm(createInitialFormState());
      setShowForm(false);
    },
    onError: (error) => {
      toast(error.message || "记录失败", "error");
    },
  });

  const deleteUsage = trpc.tokenUsage.delete.useMutation({
    onSuccess: () => {
      void utils.tokenUsage.invalidate();
      toast("已删除记录", "success");
    },
    onError: () => {
      toast("删除失败", "error");
    },
  });

  const overview = summarizeTokenUsageEntries(entries);
  const searchNeedle = deferredSearchQuery.trim().toLowerCase();
  const filteredEntries = entries.filter((entry) => {
    if (providerFilter !== "all" && entry.provider !== providerFilter) {
      return false;
    }

    if (!searchNeedle) {
      return true;
    }

    const searchableText = [
      getTokenUsageProviderLabel(entry.provider),
      getTokenUsageEntrySourceLabel(entry.source),
      entry.model,
      entry.notes,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(searchNeedle);
  });

  const totalPreview = calculateTotalTokens({
    totalTokens: parseNumberInput(form.totalTokens),
    inputTokens: parseNumberInput(form.inputTokens),
    outputTokens: parseNumberInput(form.outputTokens),
    cachedTokens: parseNumberInput(form.cachedTokens),
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const totalTokens = parseNumberInput(form.totalTokens);
    const inputTokens = parseNumberInput(form.inputTokens);
    const outputTokens = parseNumberInput(form.outputTokens);
    const cachedTokens = parseNumberInput(form.cachedTokens);

    if (totalTokens == null && totalPreview <= 0) {
      toast("请至少填写 total tokens 或输入 / 输出 breakdown", "error");
      return;
    }

    createUsage.mutate({
      provider: form.provider,
      model: form.model || undefined,
      totalTokens,
      inputTokens,
      outputTokens,
      cachedTokens,
      usageAt: form.usageAt ? new Date(form.usageAt) : undefined,
      notes: form.notes || undefined,
    });
  };

  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);

    try {
      await refetch();
    } finally {
      setIsManualRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-stone-400 dark:text-stone-500">
            AI Operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Token Usage
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-500 dark:text-stone-400">
            自动读取本机里的 Codex / Claude Code 本地 session，并按全局口径聚合；同时也支持手动补录 OpenAI API 或其他来源的 token 消耗。
          </p>
          <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
            本地来源默认每 {Math.round(TOKEN_USAGE_AUTO_REFRESH_INTERVAL_MS / 1000)} 秒自动刷新一次。
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleManualRefresh()}
            disabled={isManualRefreshing}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:hover:bg-stone-900"
          >
            <RefreshCcw className={`h-4 w-4 ${isManualRefreshing ? "animate-spin" : ""}`} />
            {isManualRefreshing ? "刷新中..." : "刷新本地用量"}
          </button>
          <button
            type="button"
            onClick={() => setShowForm((current) => !current)}
            className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
          >
            <Plus className="h-4 w-4" />
            {showForm ? "收起表单" : "添加记录"}
          </button>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        {localSources.map((source) => {
          const tone =
            source.status === "connected"
              ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/60 dark:bg-emerald-950/30"
              : source.status === "missing"
                ? "border-stone-200 bg-stone-100/80 dark:border-stone-700 dark:bg-stone-900/70"
                : "border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/30";
          const Icon = source.status === "error" ? AlertCircle : HardDrive;

          return (
            <div
              key={source.source}
              className={cn("rounded-[24px] border p-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.28)]", tone)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-stone-700 dark:bg-stone-950/80 dark:text-stone-100">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                      {source.label}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      {getTokenUsageEntrySourceLabel(source.source)}
                    </div>
                  </div>
                </div>
                <span className="rounded-full border border-white/70 px-2.5 py-1 text-xs font-medium text-stone-600 dark:border-stone-700 dark:text-stone-300">
                  {source.status === "connected"
                    ? `${source.entryCount} 条 session`
                    : source.status === "missing"
                      ? "未发现"
                      : "读取失败"}
                </span>
              </div>
              <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">
                {source.detail ?? "暂无额外状态。"}
              </p>
              {source.location && (
                <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                  {truncateText(source.location, 88)}
                </p>
              )}
            </div>
          );
        })}
      </section>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-[24px] border border-stone-200 bg-white/90 p-5 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.45)] backdrop-blur dark:border-stone-800 dark:bg-stone-950/85"
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-stone-600 dark:text-stone-300">Provider</span>
              <select
                value={form.provider}
                onChange={(event) =>
                  setForm((current) => ({ ...current, provider: event.target.value as TokenUsageProvider }))
                }
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none ring-0 transition-colors focus:border-sky-400 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              >
                {TOKEN_USAGE_PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="text-stone-600 dark:text-stone-300">Model</span>
              <input
                value={form.model}
                onChange={(event) =>
                  setForm((current) => ({ ...current, model: event.target.value }))
                }
                placeholder="例如 gpt-5.4 / claude-sonnet-4"
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition-colors focus:border-sky-400 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="text-stone-600 dark:text-stone-300">Total tokens</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={form.totalTokens}
                onChange={(event) =>
                  setForm((current) => ({ ...current, totalTokens: event.target.value }))
                }
                placeholder="如果只有总量，可以只填这里"
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition-colors focus:border-sky-400 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="text-stone-600 dark:text-stone-300">Usage time</span>
              <input
                type="datetime-local"
                value={form.usageAt}
                onChange={(event) =>
                  setForm((current) => ({ ...current, usageAt: event.target.value }))
                }
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition-colors focus:border-sky-400 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="text-stone-600 dark:text-stone-300">Input tokens</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={form.inputTokens}
                onChange={(event) =>
                  setForm((current) => ({ ...current, inputTokens: event.target.value }))
                }
                placeholder="可选"
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition-colors focus:border-sky-400 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="text-stone-600 dark:text-stone-300">Output tokens</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={form.outputTokens}
                onChange={(event) =>
                  setForm((current) => ({ ...current, outputTokens: event.target.value }))
                }
                placeholder="可选"
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition-colors focus:border-sky-400 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="text-stone-600 dark:text-stone-300">Cached tokens</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={form.cachedTokens}
                onChange={(event) =>
                  setForm((current) => ({ ...current, cachedTokens: event.target.value }))
                }
                placeholder="可选"
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition-colors focus:border-sky-400 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              />
            </label>

            <label className="space-y-2 text-sm lg:col-span-2">
              <span className="text-stone-600 dark:text-stone-300">Notes</span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="记录一下是哪个项目、哪次 session 或为什么波动"
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition-colors focus:border-sky-400 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-dashed border-stone-200 bg-stone-50/80 px-4 py-3 text-sm dark:border-stone-800 dark:bg-stone-900/70 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-stone-500 dark:text-stone-400">预估入库总量</div>
              <div className="mt-1 text-lg font-semibold text-stone-900 dark:text-stone-100">
                {formatTokenCount(totalPreview)} tokens
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setForm(createInitialFormState());
                  setShowForm(false);
                }}
                className="rounded-xl border border-stone-200 px-4 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-900"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={createUsage.isPending}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createUsage.isPending ? "保存中..." : "保存记录"}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "总用量",
            value: formatCompactTokenCount(overview.totals.allTimeTokens),
            hint: `${formatTokenCount(overview.totals.inputTokens)} in / ${formatTokenCount(
              overview.totals.outputTokens
            )} out`,
            icon: Activity,
          },
          {
            label: "最近7天",
            value: formatCompactTokenCount(overview.totals.last7DaysTokens),
            hint: `本月累计 ${formatCompactTokenCount(overview.totals.thisMonthTokens)}`,
            icon: BarChart3,
          },
          {
            label: "活跃 Provider",
            value: String(overview.totals.providerCount),
            hint:
              overview.providerBreakdown[0] != null
                ? `Top: ${getTokenUsageProviderLabel(overview.providerBreakdown[0].provider)}`
                : "还没有 provider 数据",
            icon: Bot,
          },
          {
            label: "记录数",
            value: String(overview.totals.entryCount),
            hint: `${formatTokenCount(overview.totals.cachedTokens)} cached tokens`,
            icon: Clock3,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-[24px] border border-stone-200 bg-white/92 p-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.5)] dark:border-stone-800 dark:bg-stone-950/88"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-100 text-stone-700 dark:bg-stone-900 dark:text-stone-100">
              <card.icon className="h-4 w-4" />
            </div>
            <div className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">
              {card.label}
            </div>
            <div className="mt-2 text-3xl font-semibold text-stone-900 dark:text-stone-100">
              {card.value}
            </div>
            <div className="mt-2 text-xs text-stone-500 dark:text-stone-400">{card.hint}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
        <section className="rounded-[28px] border border-stone-200 bg-white/92 p-5 shadow-[0_22px_80px_-58px_rgba(15,23,42,0.55)] dark:border-stone-800 dark:bg-stone-950/88">
          <div className="flex flex-col gap-4 border-b border-stone-200 pb-4 dark:border-stone-800 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">记录列表</h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                本机的本地 session 会实时出现在这里，手动记录也会一起参与聚合和筛选。
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="搜索用量记录..."
                  className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-9 pr-3 text-sm text-stone-900 outline-none transition-colors focus:border-sky-400 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 sm:w-64"
                />
              </div>

              <select
                aria-label="按 provider 筛选"
                value={providerFilter}
                onChange={(event) =>
                  setProviderFilter(event.target.value as "all" | TokenUsageProvider)
                }
                className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition-colors focus:border-sky-400 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100"
              >
                <option value="all">全部 provider</option>
                {TOKEN_USAGE_PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 space-y-3 [content-visibility:auto]">
            {isLoading ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">加载中...</p>
            ) : filteredEntries.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-stone-200 px-4 py-10 text-center dark:border-stone-800">
                <div className="text-base font-medium text-stone-900 dark:text-stone-100">
                  {entries.length === 0 ? "还没有 token 记录" : "没有匹配的记录"}
                </div>
                <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
                  {entries.length === 0
                    ? "如果本机已经有 Codex 或 Claude Code session，它们会自动出现在这里；你也可以手动补录其他来源。"
                    : "试试切换 provider，或搜索其他 model / notes / source。"}
                </p>
              </div>
            ) : (
              filteredEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-4 transition-colors hover:border-stone-300 dark:border-stone-800 dark:bg-stone-900/60 dark:hover:border-stone-700"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                            providerTone[entry.provider]
                          )}
                        >
                          {getTokenUsageProviderLabel(entry.provider)}
                        </span>
                        {entry.model && (
                          <span className="rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-500 dark:border-stone-700 dark:text-stone-400">
                            {entry.model}
                          </span>
                        )}
                        <span className="rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-500 dark:border-stone-700 dark:text-stone-400">
                          {getTokenUsageEntrySourceLabel(entry.source)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
                        <div>
                          <div className="text-xs uppercase tracking-[0.16em] text-stone-400 dark:text-stone-500">
                            Total
                          </div>
                          <div className="text-2xl font-semibold text-stone-900 dark:text-stone-100">
                            {formatTokenCount(entry.totalTokens)} tokens
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-stone-500 dark:text-stone-400">
                          {entry.inputTokens ? <span>In {formatTokenCount(entry.inputTokens)}</span> : null}
                          {entry.outputTokens ? <span>Out {formatTokenCount(entry.outputTokens)}</span> : null}
                          {entry.cachedTokens ? <span>Cached {formatTokenCount(entry.cachedTokens)}</span> : null}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                        <Clock3 className="h-3.5 w-3.5" />
                        <span>{formatDate(entry.usageAt)}</span>
                      </div>
                      {entry.notes && (
                        <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-stone-300">
                          {truncateText(entry.notes, 180)}
                        </p>
                      )}
                    </div>

                    {isPersistedTokenUsageSource(entry.source) && entry.canDelete ? (
                      <button
                        type="button"
                        onClick={() => {
                          const confirmed = window.confirm("确定要删除这条 token 记录吗？");
                          if (!confirmed) return;
                          deleteUsage.mutate({ id: entry.id });
                        }}
                        disabled={deleteUsage.isPending}
                        className="inline-flex items-center justify-center rounded-xl border border-stone-200 p-2 text-stone-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-stone-700 dark:text-stone-400 dark:hover:border-rose-900/70 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                        aria-label={`删除 ${getTokenUsageProviderLabel(entry.provider)} 记录`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="rounded-xl border border-stone-200 px-3 py-2 text-xs text-stone-500 dark:border-stone-700 dark:text-stone-400">
                        本地实时数据不可删除
                      </div>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[28px] border border-stone-200 bg-white/92 p-5 shadow-[0_22px_80px_-58px_rgba(15,23,42,0.55)] dark:border-stone-800 dark:bg-stone-950/88">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">Provider Breakdown</h2>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              看看当前 token 主要消耗在哪类工具上。
            </p>

            <div className="mt-5 space-y-4">
              {overview.providerBreakdown.length === 0 ? (
                <p className="text-sm text-stone-500 dark:text-stone-400">暂无 provider 数据</p>
              ) : (
                overview.providerBreakdown.map((provider) => (
                  <div key={provider.provider}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                          {getTokenUsageProviderLabel(provider.provider)}
                        </div>
                        <div className="text-xs text-stone-500 dark:text-stone-400">
                          {provider.entryCount} 条记录
                        </div>
                      </div>
                      <div className="text-right text-sm font-medium text-stone-900 dark:text-stone-100">
                        {formatCompactTokenCount(provider.totalTokens)}
                      </div>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
                        style={{ width: `${Math.max(provider.share * 100, 6)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-stone-200 bg-white/92 p-5 shadow-[0_22px_80px_-58px_rgba(15,23,42,0.55)] dark:border-stone-800 dark:bg-stone-950/88">
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">记录建议</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-stone-600 dark:text-stone-300">
              <p>如果工具只给了总量，直接填 `Total tokens` 就可以。</p>
              <p>如果你手头有 input / output / cached breakdown，补进去后 Dashboard 会展示更完整的结构。</p>
              <p>建议在 `Notes` 写上项目名或场景，后面排查成本波动会更轻松。</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
