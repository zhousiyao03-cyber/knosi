"use client";

import { trpc } from "@/lib/trpc";
import { FileText } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface WikiLinkPreviewProps {
  noteId: string;
  position: { top: number; left: number };
}

export function WikiLinkPreview({ noteId, position }: WikiLinkPreviewProps) {
  const { data: note, isLoading } = trpc.notes.get.useQuery(
    { id: noteId },
    { staleTime: 30000 }
  );

  if (isLoading) {
    return (
      <div
        className="fixed z-50 w-[300px] rounded-xl border border-stone-200 bg-white p-3 shadow-lg dark:border-stone-700 dark:bg-stone-900"
        style={{ top: position.top, left: position.left }}
      >
        <div className="h-4 w-3/4 animate-pulse rounded bg-stone-200 dark:bg-stone-800" />
        <div className="mt-2 h-3 w-full animate-pulse rounded bg-stone-100 dark:bg-stone-800/50" />
      </div>
    );
  }

  if (!note) {
    return (
      <div
        className="fixed z-50 w-[300px] rounded-xl border border-stone-200 bg-white p-3 shadow-lg dark:border-stone-700 dark:bg-stone-900"
        style={{ top: position.top, left: position.left }}
      >
        <div className="flex items-center gap-2 text-sm text-stone-400">
          <FileText size={14} />
          <span>Note not found — click to create</span>
        </div>
      </div>
    );
  }

  const tags = (() => {
    try {
      const v = JSON.parse(note.tags ?? "[]");
      return Array.isArray(v) ? (v as string[]) : [];
    } catch {
      return [];
    }
  })();

  return (
    <div
      className="fixed z-50 w-[300px] rounded-xl border border-stone-200 bg-white p-3 shadow-lg dark:border-stone-700 dark:bg-stone-900"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center gap-2">
        {note.icon ? (
          <span className="text-lg">{note.icon}</span>
        ) : (
          <FileText size={16} className="text-stone-400" />
        )}
        <h4 className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
          {note.title || "Untitled"}
        </h4>
      </div>

      {note.plainText && (
        <p className="mt-1.5 line-clamp-2 text-xs text-stone-500 dark:text-stone-400">
          {note.plainText.slice(0, 150)}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {note.updatedAt && (
          <span className="text-[10px] text-stone-400">
            {formatDate(note.updatedAt)}
          </span>
        )}
        {tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
