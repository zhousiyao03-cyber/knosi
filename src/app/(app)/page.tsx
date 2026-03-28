"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckSquare,
  FileText,
} from "lucide-react";
import {
  formatCompactTokenCount,
  formatTokenCount,
  getTokenUsageProviderLabel,
  TOKEN_USAGE_AUTO_REFRESH_INTERVAL_MS,
} from "@/lib/token-usage";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/utils";

const statCardMeta = [
  {
    id: "notes" as const,
    label: "笔记",
    href: "/notes",
    icon: FileText,
    color: "text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/50",
  },
  {
    id: "todos" as const,
    label: "待办",
    href: "/todos",
    icon: CheckSquare,
    color: "text-green-600 bg-green-50 dark:text-green-300 dark:bg-green-950/50",
  },
];

const enableTokenUsage = process.env.NEXT_PUBLIC_ENABLE_TOKEN_USAGE === "true";

export default function DashboardPage() {
  const { data, isLoading } = trpc.dashboard.stats.useQuery();
  const { data: tokenOverview, isLoading: tokenLoading } = trpc.tokenUsage.overview.useQuery(
    undefined,
    {
      enabled: enableTokenUsage,
      refetchInterval: enableTokenUsage ? TOKEN_USAGE_AUTO_REFRESH_INTERVAL_MS : false,
      refetchIntervalInBackground: true,
      refetchOnWindowFocus: true,
    }
  );

  const formatTodayTime = (date: Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">首页</h1>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          知识库、任务和 AI token 消耗都会汇总在这里，方便快速扫一眼当前工作状态。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {statCardMeta.map((card) => (
          <Link
            key={card.id}
            href={card.href}
            className="rounded-[22px] border border-stone-200 bg-white/92 p-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.45)] transition-all hover:border-stone-300 hover:shadow-[0_24px_60px_-44px_rgba(15,23,42,0.55)] dark:border-stone-800 dark:bg-stone-950/88 dark:hover:border-stone-700"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${card.color}`}>
              <card.icon className="h-4 w-4" />
            </div>
            <div className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {isLoading ? "-" : (data?.counts[card.id] ?? 0)}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{card.label}</div>
          </Link>
        ))}

        {enableTokenUsage && (
          <Link
            href="/usage"
            className="rounded-[22px] border border-stone-200 bg-white/92 p-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.45)] transition-all hover:border-stone-300 hover:shadow-[0_24px_60px_-44px_rgba(15,23,42,0.55)] dark:border-stone-800 dark:bg-stone-950/88 dark:hover:border-stone-700"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-300">
              <Activity className="h-4 w-4" />
            </div>
            <div className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
              {tokenLoading
                ? "-"
                : formatCompactTokenCount(tokenOverview?.totals.last7DaysTokens ?? 0)}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">最近7天 Token</div>
            <div className="mt-1 text-[11px] text-stone-400 dark:text-stone-500">
              {tokenLoading
                ? "统计中..."
                : tokenOverview && tokenOverview.totals.entryCount > 0
                  ? `${tokenOverview.totals.providerCount} 个 provider`
                  : "支持本机本地自动读取"}
            </div>
          </Link>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">最近笔记</h2>
            <Link
              href="/notes"
              className="flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-700"
            >
              查看全部 <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-xs text-gray-400">加载中...</p>
            ) : data?.recentNotes.length === 0 ? (
              <p className="text-xs text-gray-400">暂无笔记</p>
            ) : (
              data?.recentNotes.map((note) => (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="block rounded-[18px] border border-stone-200 bg-white/80 p-3 transition-colors hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-950/55 dark:hover:bg-stone-900"
                >
                  <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {note.title}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    {note.updatedAt
                      ? new Date(note.updatedAt).toLocaleDateString("zh-CN", {
                          month: "short",
                          day: "numeric",
                        })
                      : ""}
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              今日任务
              {data && data.todayTodos.length > 0 && (
                <span className="ml-1 text-amber-600">({data.todayTodos.length} 项)</span>
              )}
            </h2>
            <Link
              href="/todos"
              className="flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-700"
            >
              查看全部 <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {isLoading ? (
              <p className="text-xs text-gray-400">加载中...</p>
            ) : data?.todayTodos.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-stone-200 px-3 py-4 text-xs text-stone-400 dark:border-stone-800">
                今天还没有安排任务
                {data && data.pendingTodos.length > 0 ? `，当前还有 ${data.pendingTodos.length} 个待办可安排。` : "。"}
              </div>
            ) : (
              data?.todayTodos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-2 rounded-[18px] border border-stone-200 bg-white/80 p-3 dark:border-stone-800 dark:bg-stone-950/55"
                >
                  <CheckSquare
                    size={14}
                    className={
                      todo.status === "in_progress"
                        ? "shrink-0 text-blue-500"
                        : "shrink-0 text-gray-300"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-gray-900 dark:text-gray-100">
                      {todo.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      {todo.dueDate && (
                        <span className="text-amber-600 dark:text-amber-300">
                          {formatTodayTime(todo.dueDate)}
                        </span>
                      )}
                      {todo.status === "in_progress" && (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
                          进行中
                        </span>
                      )}
                    </div>
                  </div>
                  {todo.priority === "high" && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-600 dark:bg-red-950/50 dark:text-red-300">
                      高
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {enableTokenUsage && (
      <section className="rounded-[28px] border border-stone-200 bg-white/92 p-5 shadow-[0_22px_80px_-58px_rgba(15,23,42,0.55)] dark:border-stone-800 dark:bg-stone-950/88">
        <div className="flex flex-col gap-3 border-b border-stone-200 pb-4 dark:border-stone-800 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
              Token Usage
            </h2>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              统一查看本机里的 Codex / Claude Code 本地 session，以及手动补录的 API token 消耗趋势。
            </p>
          </div>
          <Link
            href="/usage"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-cyan-700 transition-colors hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
          >
            打开完整页面 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {tokenLoading ? (
          <p className="pt-5 text-sm text-stone-500 dark:text-stone-400">正在加载 token 统计...</p>
        ) : tokenOverview == null || tokenOverview.totals.entryCount === 0 ? (
          <div className="pt-5">
            <div className="rounded-[22px] border border-dashed border-stone-200 px-4 py-10 text-center dark:border-stone-800">
              <div className="text-base font-medium text-stone-900 dark:text-stone-100">
                还没有 token 使用记录
              </div>
              <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
                去单独页面看看本机本地读取状态，或者手动补一条 OpenAI API 记录，Dashboard 会自动同步聚合结果。
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
            <div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "总用量",
                    value: formatCompactTokenCount(tokenOverview.totals.allTimeTokens),
                    hint: `${formatTokenCount(tokenOverview.totals.inputTokens)} input`,
                  },
                  {
                    label: "最近7天",
                    value: formatCompactTokenCount(tokenOverview.totals.last7DaysTokens),
                    hint: `本月累计 ${formatCompactTokenCount(tokenOverview.totals.thisMonthTokens)}`,
                  },
                  {
                    label: "Cached",
                    value: formatCompactTokenCount(tokenOverview.totals.cachedTokens),
                    hint: `${tokenOverview.totals.entryCount} 条记录`,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[22px] border border-stone-200 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-900/55"
                  >
                    <div className="text-xs uppercase tracking-[0.16em] text-stone-400 dark:text-stone-500">
                      {item.label}
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-stone-900 dark:text-stone-100">
                      {item.value}
                    </div>
                    <div className="mt-2 text-xs text-stone-500 dark:text-stone-400">{item.hint}</div>
                  </div>
                ))}
              </div>

              <div className="mt-5">
                {tokenOverview.localSources.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2 text-xs text-stone-500 dark:text-stone-400">
                    {tokenOverview.localSources.map((source) => (
                      <span
                        key={source.source}
                        className="rounded-full border border-stone-200 px-2.5 py-1 dark:border-stone-700"
                      >
                        {source.label}
                        {source.status === "connected"
                          ? ` · ${source.entryCount} 条`
                          : source.status === "missing"
                            ? " · 未发现"
                            : " · 读取失败"}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mb-3 text-sm font-medium text-stone-700 dark:text-stone-200">
                  最近记录
                </div>
                <div className="space-y-2">
                  {tokenOverview.recentEntries.slice(0, 3).map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-[18px] border border-stone-200 bg-white/80 p-3 dark:border-stone-800 dark:bg-stone-950/55"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                          {getTokenUsageProviderLabel(entry.provider)}
                          {entry.model ? ` · ${entry.model}` : ""}
                        </div>
                        <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                          {formatTokenCount(entry.totalTokens)} tokens
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                        {formatDate(entry.usageAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-3 text-sm font-medium text-stone-700 dark:text-stone-200">
                Provider 分布
              </div>
              <div className="space-y-4">
                {tokenOverview.providerBreakdown.map((provider) => (
                  <div key={provider.provider}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
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
                        className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-400"
                        style={{ width: `${Math.max(provider.share * 100, 6)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
      )}
    </div>
  );
}
