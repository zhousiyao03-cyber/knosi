"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

const MASTERY_TINT: Record<string, string> = {
  blank: "border-stone-300 text-stone-600 dark:border-stone-700 dark:text-stone-400",
  heard: "border-sky-400/60 text-sky-700 dark:text-sky-300",
  learning: "border-amber-400/60 text-amber-700 dark:text-amber-300",
  mastered: "border-emerald-500/60 text-emerald-700 dark:text-emerald-300",
};

export function CurriculumTopicsBar({
  noteId,
  kind = "learning",
}: {
  noteId: string;
  kind?: "learning" | "general";
}) {
  const utils = trpc.useUtils();
  const linkedQuery = trpc.curriculum.getTopicsForNote.useQuery({ noteId, kind });
  const [pickerOpen, setPickerOpen] = useState(false);

  const linked = useMemo(() => linkedQuery.data ?? [], [linkedQuery.data]);
  const linkedIds = useMemo(() => new Set(linked.map((t) => t.id)), [linked]);

  const unlink = trpc.curriculum.unlinkNote.useMutation({
    onSuccess: () => {
      utils.curriculum.getTopicsForNote.invalidate({ noteId, kind });
      utils.curriculum.getCurriculum.invalidate();
    },
  });

  if (linkedQuery.isLoading) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-stone-400 dark:text-stone-500 mr-1">
        Curriculum
      </span>
      {linked.map((topic) => (
        <span
          key={topic.id}
          className={cn(
            "group inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
            MASTERY_TINT[topic.mastery] ?? MASTERY_TINT.blank
          )}
          title={`${topic.trackTitle} › ${topic.areaTitle}`}
        >
          <Link
            href={`/learn/map?topicId=${encodeURIComponent(topic.id)}`}
            className="truncate max-w-[200px]"
          >
            {topic.title}
          </Link>
          <button
            type="button"
            onClick={() => unlink.mutate({ topicId: topic.id, noteId, kind })}
            className="opacity-50 hover:opacity-100"
            aria-label={`Unlink ${topic.title}`}
          >
            ×
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="inline-flex items-center rounded-full border border-dashed border-stone-300 px-2 py-0.5 text-xs text-stone-500 hover:border-stone-500 dark:border-stone-700 dark:text-stone-400"
        data-testid="add-curriculum-topic"
      >
        + Add topic
      </button>

      {pickerOpen && (
        <CurriculumTopicPicker
          noteId={noteId}
          kind={kind}
          excludedIds={linkedIds}
          onClose={() => setPickerOpen(false)}
          onLinked={() => {
            utils.curriculum.getTopicsForNote.invalidate({ noteId, kind });
            utils.curriculum.getCurriculum.invalidate();
          }}
        />
      )}
    </div>
  );
}

function CurriculumTopicPicker({
  noteId,
  kind,
  excludedIds,
  onClose,
  onLinked,
}: {
  noteId: string;
  kind: "learning" | "general";
  excludedIds: Set<string>;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [query, setQuery] = useState("");
  const searchQuery = trpc.curriculum.searchTopics.useQuery(
    { query: query.trim() || undefined, limit: 80 }
  );
  const linkMutation = trpc.curriculum.linkNote.useMutation({
    onSuccess: () => {
      onLinked();
      onClose();
    },
  });
  const onPickTopic = (topicId: string) => {
    linkMutation.mutate({ topicId, noteId, kind });
  };

  const items = (searchQuery.data ?? []).filter((t) => !excludedIds.has(t.id));
  const grouped = useMemo(() => {
    const map = new Map<string, { trackTitle: string; areaTitle: string; topics: typeof items }>();
    for (const t of items) {
      const key = `${t.trackId}::${t.areaId}`;
      const entry = map.get(key) ?? {
        trackTitle: t.trackTitle,
        areaTitle: t.areaTitle,
        topics: [] as typeof items,
      };
      entry.topics.push(t);
      map.set(key, entry);
    }
    return Array.from(map.values());
  }, [items]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      data-testid="curriculum-topic-picker"
    >
      <div
        className="w-full max-w-lg rounded-lg border border-stone-200 bg-white p-4 shadow-lg dark:border-stone-800 dark:bg-stone-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Link curriculum topics</h3>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
          >
            ×
          </button>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search topics…"
          className="mb-3 w-full rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-600"
          autoFocus
          data-testid="curriculum-picker-search"
        />
        <div className="max-h-80 overflow-y-auto space-y-3">
          {searchQuery.isLoading && (
            <div className="text-xs text-stone-500">Loading…</div>
          )}
          {!searchQuery.isLoading && grouped.length === 0 && (
            <div className="text-xs text-stone-500">No matching topics.</div>
          )}
          {grouped.map((group, idx) => (
            <div key={idx}>
              <div className="text-[11px] font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500 mb-1">
                {group.trackTitle} › {group.areaTitle}
              </div>
              <div className="space-y-0.5">
                {group.topics.map((topic) => (
                  <button
                    key={topic.id}
                    onClick={() => onPickTopic(topic.id)}
                    className="w-full rounded px-2 py-1 text-left text-sm text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-900"
                    data-testid="curriculum-picker-item"
                  >
                    {topic.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
