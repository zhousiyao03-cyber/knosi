"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Search, FileText, Sparkles, X } from "lucide-react";
import { useLocalSearch } from "@/components/local-search/provider";

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

/** Render a snippet with `<mark>` wrappers around its highlight ranges. */
function SnippetText({
  snippet,
}: {
  snippet: { text: string; highlights: Array<[number, number]> };
}) {
  const sorted = useMemo(
    () => [...snippet.highlights].sort((a, b) => a[0] - b[0]),
    [snippet.highlights]
  );
  const parts: Array<{ text: string; mark: boolean }> = [];
  let cursor = 0;
  for (const [s, e] of sorted) {
    if (cursor < s) parts.push({ text: snippet.text.slice(cursor, s), mark: false });
    parts.push({ text: snippet.text.slice(s, e), mark: true });
    cursor = e;
  }
  if (cursor < snippet.text.length) {
    parts.push({ text: snippet.text.slice(cursor), mark: false });
  }
  return (
    <>
      {parts.map((p, i) =>
        p.mark ? (
          <mark
            key={i}
            className="bg-yellow-200 text-gray-900 rounded-sm px-0.5"
          >
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

export function SearchDialogModal({
  onClose,
  localEnabled,
  onToggleLocal,
}: {
  onClose: () => void;
  localEnabled: boolean;
  onToggleLocal: (next: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const local = useLocalSearch();

  // Server-side fallback: only fetched when the local engine is off.
  const { data: serverData } = trpc.dashboard.search.useQuery(
    { query },
    { enabled: !localEnabled && query.length > 0 }
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const close = () => {
    setQuery("");
    onClose();
  };

  const navigate = (href: string) => {
    close();
    router.push(href);
  };

  const localHits = useMemo(
    () => (localEnabled && query.length > 0 ? local.search(query, 10) : []),
    [localEnabled, query, local]
  );

  const usingLocal = localEnabled && local.status === "ready";
  const localBusy = localEnabled && (local.status === "loading" || local.status === "idle");

  // Unified result list. Server path returns title-only; local path also
  // attaches a snippet.
  const allResults = usingLocal
    ? localHits.map((h) => ({
        id: h.id,
        title: h.title,
        href: `/notes/${h.id}`,
        icon: FileText,
        snippet: h.snippet,
      }))
    : (serverData?.notes ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        href: `/notes/${n.id}`,
        icon: FileText,
        snippet: null as null | { text: string; highlights: Array<[number, number]> },
      }));

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-stone-900/25 backdrop-blur-[2px]"
        onClick={close}
      />

      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
        <div className="overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-[0_24px_70px_-28px_rgba(15,23,42,0.45)] dark:border-stone-800 dark:bg-stone-950">
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3 dark:border-stone-800">
            <Search size={18} className="shrink-0 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                usingLocal
                  ? "Search note titles and content…"
                  : "Search notes by title…"
              }
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

          {/* Toggle row */}
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2 dark:border-stone-800">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
              <input
                type="checkbox"
                checked={localEnabled}
                onChange={(e) => onToggleLocal(e.target.checked)}
                className="h-3 w-3 accent-stone-700"
              />
              <Sparkles size={12} className="text-amber-500" />
              <span>Full-text (in-browser)</span>
            </label>
            {localEnabled ? (
              <span className="text-[11px] text-stone-400">
                {local.status === "ready"
                  ? `${local.docCount} docs indexed`
                  : local.status === "loading"
                    ? "Building index…"
                    : local.status === "error"
                      ? "Index failed — using server fallback"
                      : "Idle"}
              </span>
            ) : (
              <span className="text-[11px] text-stone-400">Server (titles only)</span>
            )}
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-auto">
            {query.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-stone-400">
                Start typing to search
              </div>
            ) : localBusy && allResults.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-stone-400">
                Building local index…
              </div>
            ) : allResults.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-stone-400">
                No results found
              </div>
            ) : (
              <div className="py-2">
                {allResults.map((item) => (
                  <button
                    key={`note-${item.id}`}
                    onClick={() => navigate(item.href)}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-stone-50 dark:hover:bg-stone-900"
                  >
                    <item.icon
                      size={16}
                      className="mt-0.5 shrink-0 text-stone-400"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-sm text-stone-900 dark:text-stone-100">
                        <HighlightText text={item.title} query={query} />
                      </span>
                      {item.snippet ? (
                        <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
                          <SnippetText snippet={item.snippet} />
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-stone-400 shrink-0">
                      Note
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
              Open search
            </span>
            <span>
              <kbd className="rounded bg-stone-100 px-1.5 py-0.5 text-stone-500 dark:bg-stone-900 dark:text-stone-400">
                ESC
              </kbd>{" "}
              Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
