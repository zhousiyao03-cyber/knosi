"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Search, FileText, Bookmark, CheckSquare, X } from "lucide-react";

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi"
  );
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 text-gray-900 rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export function SearchDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const { data } = trpc.dashboard.search.useQuery(
    { query },
    { enabled: open && query.length > 0 }
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    },
    []
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const handleOpen = () => setOpen(true);

    window.addEventListener("second-brain:open-search", handleOpen);
    return () =>
      window.removeEventListener("second-brain:open-search", handleOpen);
  }, []);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  const navigate = (href: string) => {
    close();
    router.push(href);
  };

  const allResults = [
    ...(data?.notes.map((n) => ({
      id: n.id,
      title: n.title,
      type: "note" as const,
      href: `/notes/${n.id}`,
      icon: FileText,
    })) ?? []),
    ...(data?.bookmarks.map((b) => ({
      id: b.id,
      title: b.title ?? b.url ?? "无标题",
      type: "bookmark" as const,
      href: "/bookmarks",
      icon: Bookmark,
    })) ?? []),
    ...(data?.todos.map((t) => ({
      id: t.id,
      title: t.title,
      type: "todo" as const,
      href: "/todos",
      icon: CheckSquare,
    })) ?? []),
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-stone-900/25 backdrop-blur-[2px]"
        onClick={close}
      />

      {/* Dialog */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
        <div className="overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-[0_24px_70px_-28px_rgba(15,23,42,0.45)] dark:border-stone-800 dark:bg-stone-950">
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3 dark:border-stone-800">
            <Search size={18} className="shrink-0 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索笔记、收藏、待办..."
              className="flex-1 bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400 dark:text-stone-100 dark:placeholder:text-stone-500"
              autoFocus
            />
            <button
              onClick={close}
              className="text-stone-400 transition-colors hover:text-stone-700 dark:hover:text-stone-200"
            >
              <X size={16} />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-auto">
            {query.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-stone-400">
                输入关键词搜索
              </div>
            ) : allResults.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-stone-400">
                没有找到结果
              </div>
            ) : (
              <div className="py-2">
                {allResults.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => navigate(item.href)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-stone-50 dark:hover:bg-stone-900"
                  >
                    <item.icon size={16} className="shrink-0 text-stone-400" />
                    <span className="flex-1 truncate text-sm text-stone-900 dark:text-stone-100">
                      <HighlightText text={item.title} query={query} />
                    </span>
                    <span className="text-xs text-stone-400">
                      {item.type === "note"
                        ? "笔记"
                        : item.type === "bookmark"
                          ? "收藏"
                          : "待办"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 border-t border-stone-100 px-4 py-2 text-xs text-stone-400 dark:border-stone-800">
            <span>
              <kbd className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-500 dark:bg-stone-900 dark:text-stone-400">
                ⌘K
              </kbd>{" "}
              打开搜索
            </span>
            <span>
              <kbd className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-500 dark:bg-stone-900 dark:text-stone-400">
                ESC
              </kbd>{" "}
              关闭
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
