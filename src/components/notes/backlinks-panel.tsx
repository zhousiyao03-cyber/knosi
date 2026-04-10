"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, FileText, Link2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

interface BacklinksPanelProps {
  noteId: string;
}

export function BacklinksPanel({ noteId }: BacklinksPanelProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);

  const { data: backlinks = [], isLoading } = trpc.notes.backlinks.useQuery(
    { noteId },
    { staleTime: 15000 }
  );

  if (isLoading) return null;
  if (backlinks.length === 0) return null;

  return (
    <div className="mt-8 border-t border-stone-200 pt-6 dark:border-stone-800">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="mb-3 flex items-center gap-2 text-sm font-medium text-stone-500 transition-colors hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Link2 size={14} />
        <span>
          {backlinks.length} backlink{backlinks.length !== 1 ? "s" : ""}
        </span>
      </button>

      {expanded && (
        <div className="space-y-1.5">
          {backlinks.map((link) => (
            <button
              key={link.sourceNoteId}
              onClick={() => router.push(`/notes/${link.sourceNoteId}`)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                "text-stone-600 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-900"
              )}
            >
              {link.sourceIcon ? (
                <span className="shrink-0 text-base">{link.sourceIcon}</span>
              ) : (
                <FileText size={14} className="shrink-0 text-stone-400" />
              )}
              <span className="min-w-0 flex-1 truncate">
                {link.sourceTitle || "Untitled"}
              </span>
              {link.updatedAt && (
                <span className="shrink-0 text-xs text-stone-400">
                  {formatDate(link.updatedAt)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
