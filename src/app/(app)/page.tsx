"use client";

import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function DashboardPage() {
  const { data, isLoading } = trpc.dashboard.stats.useQuery();
  const noteCount = isLoading ? "-" : (data?.counts.notes ?? 0);

  return (
    <div className="space-y-6 xl:space-y-8">
      <section className="rounded-[30px] border border-stone-200 bg-white/88 p-6 shadow-[0_28px_80px_-60px_rgba(15,23,42,0.55)] dark:border-stone-800 dark:bg-stone-950/82">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight text-stone-950 dark:text-stone-50">
              首页
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500 dark:text-stone-400">
              把最近笔记和 AI token 消耗放在同一个工作台里，打开首页就能快速进入当前最重要的上下文。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/notes"
              className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 dark:border-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
            >
              打开笔记 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Link
            href="/notes"
            className="rounded-[24px] border border-stone-200 bg-stone-50/90 p-5 transition-all hover:border-stone-300 hover:bg-white dark:border-stone-800 dark:bg-stone-900/60 dark:hover:border-stone-700 dark:hover:bg-stone-900"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">
              <FileText className="h-4 w-4" />
            </div>
            <div className="mt-5 text-3xl font-semibold text-stone-950 dark:text-stone-50">
              {noteCount}
            </div>
            <div className="mt-1 text-sm font-medium text-stone-700 dark:text-stone-300">笔记</div>
            <div className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">
              最近更新的内容会直接出现在主面板，适合从首页继续写。
            </div>
          </Link>

          <div className="rounded-[24px] border border-stone-200 bg-stone-50/90 p-5 dark:border-stone-800 dark:bg-stone-900/60">
            <div className="text-[11px] uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">
              Workspace
            </div>
            <div className="mt-2 text-xl font-semibold text-stone-950 dark:text-stone-50">
              从最近的笔记继续工作
            </div>
            <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">
              首页现在只保留高频信息，线上版本不再展示 Token Usage，把主注意力留给内容本身。
            </p>
          </div>

          <div className="rounded-[24px] border border-stone-200 bg-stone-50/90 p-5 dark:border-stone-800 dark:bg-stone-900/60">
            <div className="text-[11px] uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">
              Flow
            </div>
            <div className="mt-2 text-xl font-semibold text-stone-950 dark:text-stone-50">
              写作、检索、问答在一个地方闭环
            </div>
            <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-400">
              笔记是主入口，搜索和 Ask AI 作为补充能力，不再把首页做成多模块堆叠。
            </p>
          </div>
        </div>
      </section>

      <div
        data-testid="dashboard-content-grid"
        className="grid gap-6 xl:grid-cols-12 xl:items-start"
      >
        <section
          data-testid="dashboard-notes-panel"
          className="rounded-[28px] border border-stone-200 bg-white/92 p-5 shadow-[0_22px_80px_-58px_rgba(15,23,42,0.55)] dark:border-stone-800 dark:bg-stone-950/88 xl:col-span-12"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">最近笔记</h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                从这里直接回到最近工作的内容，减少重新定位上下文的时间。
              </p>
            </div>
            <Link
              href="/notes"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
            >
              查看全部 <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {isLoading ? (
              <div className="rounded-[22px] border border-dashed border-stone-200 px-4 py-10 text-center text-sm text-stone-400 dark:border-stone-800">
                正在加载最近笔记...
              </div>
            ) : data?.recentNotes.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-stone-200 px-4 py-10 text-center dark:border-stone-800">
                <div className="text-base font-medium text-stone-900 dark:text-stone-100">
                  还没有笔记
                </div>
                <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
                  先创建一篇笔记，首页就会开始帮你汇总最近内容。
                </p>
              </div>
            ) : (
              data?.recentNotes.map((note, index) => (
                <Link
                  key={note.id}
                  href={`/notes/${note.id}`}
                  className="block rounded-[22px] border border-stone-200 bg-stone-50/80 p-4 transition-all hover:border-stone-300 hover:bg-white dark:border-stone-800 dark:bg-stone-900/50 dark:hover:border-stone-700 dark:hover:bg-stone-900"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">
                        Recent {String(index + 1).padStart(2, "0")}
                      </div>
                      <div className="mt-2 truncate text-base font-medium text-stone-900 dark:text-stone-100">
                        {note.title}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-stone-400 dark:text-stone-500">
                      {note.updatedAt
                        ? new Date(note.updatedAt).toLocaleDateString("zh-CN", {
                            month: "short",
                            day: "numeric",
                          })
                        : ""}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
