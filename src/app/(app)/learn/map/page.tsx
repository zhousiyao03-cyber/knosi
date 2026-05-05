"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/server/routers/_app";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type RouterOutputs = inferRouterOutputs<AppRouter>;

const MASTERY_LABELS: Record<string, string> = {
  blank: "Blank",
  heard: "Heard",
  learning: "Learning",
  mastered: "Mastered",
};

const MASTERY_COLORS: Record<string, string> = {
  blank:
    "border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:bg-stone-800/60",
  heard:
    "border-sky-300 bg-sky-50 text-sky-800 hover:border-sky-500 hover:bg-sky-100 dark:border-sky-500/40 dark:bg-sky-500/10 dark:text-sky-200 dark:hover:border-sky-400",
  learning:
    "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-500 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:border-amber-400",
  mastered:
    "border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-500 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-200 dark:hover:border-emerald-400",
};

const MASTERY_DOT: Record<string, string> = {
  blank: "bg-stone-400 dark:bg-stone-600",
  heard: "bg-sky-500 dark:bg-sky-400",
  learning: "bg-amber-500 dark:bg-amber-400",
  mastered: "bg-emerald-500 dark:bg-emerald-400",
};

const MASTERY_ORDER = ["blank", "heard", "learning", "mastered"] as const;

type CurriculumData = RouterOutputs["curriculum"]["getCurriculum"];
type Track = CurriculumData["tracks"][number];
type Topic = Track["areas"][number]["topics"][number];

export default function CurriculumMapPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const curriculumQuery = trpc.curriculum.getCurriculum.useQuery();

  const [explicitTrackId, setExplicitTrackId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const deepLinkAppliedRef = useRef(false);

  const tracks = useMemo(
    () => curriculumQuery.data?.tracks ?? [],
    [curriculumQuery.data]
  );

  // ?topicId=... — locate the topic, switch to its track, open the side panel.
  // Run only once per arrival to avoid fighting subsequent user navigation.
  useEffect(() => {
    if (deepLinkAppliedRef.current) return;
    if (tracks.length === 0) return;

    const targetTopicId = searchParams?.get("topicId");
    if (!targetTopicId) return;

    for (const track of tracks) {
      for (const area of track.areas) {
        if (area.topics.some((t) => t.id === targetTopicId)) {
          setExplicitTrackId(track.id);
          setSelectedTopicId(targetTopicId);
          deepLinkAppliedRef.current = true;

          // Defer scroll until after render commits the new track.
          requestAnimationFrame(() => {
            const el = document.querySelector(
              `[data-topic-id="${targetTopicId}"]`
            );
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
          return;
        }
      }
    }
    // If topicId doesn't match anything (stale link), still mark applied so we
    // don't loop forever as user clicks around.
    deepLinkAppliedRef.current = true;
  }, [tracks, searchParams]);

  const activeTrack = useMemo(() => {
    if (tracks.length === 0) return undefined;
    return tracks.find((t) => t.id === explicitTrackId) ?? tracks[0];
  }, [tracks, explicitTrackId]);

  const stats = useMemo(() => {
    if (!activeTrack) return { total: 0, mastered: 0, learning: 0, heard: 0 };
    const all = activeTrack.areas.flatMap((a) => a.topics);
    return {
      total: all.length,
      mastered: all.filter((t) => t.mastery === "mastered").length,
      learning: all.filter((t) => t.mastery === "learning").length,
      heard: all.filter((t) => t.mastery === "heard").length,
    };
  }, [activeTrack]);

  const setMastery = trpc.curriculum.setMastery.useMutation({
    onSuccess: () => utils.curriculum.getCurriculum.invalidate(),
  });
  const resetMutation = trpc.curriculum.resetToDefault.useMutation({
    onSuccess: () => utils.curriculum.getCurriculum.invalidate(),
  });
  const rerunMutation = trpc.curriculum.rerunAutoLink.useMutation({
    onSuccess: () => utils.curriculum.getCurriculum.invalidate(),
  });

  const onResetClick = () => {
    if (!confirm("Reset curriculum to default? This wipes your custom states and re-seeds.")) return;
    resetMutation.mutate();
  };

  if (curriculumQuery.isLoading) {
    return (
      <div className="p-8 text-stone-600 dark:text-stone-400">
        <div className="text-lg">Setting up your curriculum…</div>
        <div className="mt-2 text-sm text-stone-500">
          First visit triggers seed and auto-link of existing notes. This takes a few seconds.
        </div>
      </div>
    );
  }

  if (!activeTrack) {
    return (
      <div className="p-8 text-stone-600 dark:text-stone-400">
        <div>No curriculum yet.</div>
        <button
          className="mt-4 rounded border border-stone-300 px-3 py-1.5 text-sm hover:border-stone-500 dark:border-stone-700 dark:hover:border-stone-500"
          onClick={() => curriculumQuery.refetch()}
        >
          Reload
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full" data-page="curriculum-map">
      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-stone-900 dark:text-stone-100">
              Curriculum Map
            </h1>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Your knowledge gap analysis across target roles.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 transition hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
              onClick={() => rerunMutation.mutate()}
              disabled={rerunMutation.isPending}
              data-testid="rerun-autolink"
            >
              {rerunMutation.isPending ? "Linking…" : "Re-link notes"}
            </button>
            <button
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 transition hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
              onClick={onResetClick}
              disabled={resetMutation.isPending}
              data-testid="reset-curriculum"
            >
              Reset
            </button>
          </div>
        </header>

        <nav
          className="mb-6 -mx-1 flex items-center gap-2 overflow-x-auto pb-1 px-1"
          data-testid="track-tabs"
        >
          {tracks.map((track) => (
            <button
              key={track.id}
              onClick={() => setExplicitTrackId(track.id)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm transition-colors",
                track.id === activeTrack.id
                  ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-400 dark:hover:border-stone-600"
              )}
              data-track-id={track.id}
            >
              <span className="mr-1.5">{track.icon}</span>
              {track.title}
            </button>
          ))}
        </nav>

        <div className="mb-8 flex items-center gap-4 text-xs text-stone-600 dark:text-stone-400">
          <Stat label="Mastered" value={stats.mastered} total={stats.total} dotClass={MASTERY_DOT.mastered} />
          <Stat label="Learning" value={stats.learning} total={stats.total} dotClass={MASTERY_DOT.learning} />
          <Stat label="Heard" value={stats.heard} total={stats.total} dotClass={MASTERY_DOT.heard} />
          <Stat label="Total" value={stats.total} total={stats.total} dotClass={MASTERY_DOT.blank} />
        </div>

        <div className="space-y-8">
          {activeTrack.areas.map((area) => (
            <section key={area.id} data-area-id={area.id}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-700 dark:text-stone-300">
                {area.title}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {area.topics.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    onClick={() => setSelectedTopicId(topic.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {selectedTopicId && (
        <>
          <button
            type="button"
            aria-label="Close panel"
            className="fixed inset-0 z-20 bg-black/30 sm:hidden"
            onClick={() => setSelectedTopicId(null)}
          />
          <SidePanel
            topicId={selectedTopicId}
            onClose={() => setSelectedTopicId(null)}
            onMasteryChange={(mastery) =>
              setMastery.mutate({ topicId: selectedTopicId, mastery })
            }
            onJumpToNote={(noteId, kind, parentId) => {
              setSelectedTopicId(null);
              if (kind === "learning" && parentId) {
                router.push(`/learn/${parentId}/${noteId}`);
              } else {
                router.push(`/notes/${noteId}`);
              }
            }}
          />
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  total,
  dotClass,
}: {
  label: string;
  value: number;
  total: number;
  dotClass: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", dotClass)} />
      <span className="text-stone-700 dark:text-stone-300">{label}</span>
      <span className="text-stone-500 dark:text-stone-500">
        {value}
        {label !== "Total" && total > 0 && ` (${pct}%)`}
      </span>
    </div>
  );
}

function TopicCard({ topic, onClick }: { topic: Topic; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-topic-id={topic.id}
      data-mastery={topic.mastery}
      className={cn(
        "group rounded-md border px-3 py-2.5 text-left text-xs transition-colors",
        MASTERY_COLORS[topic.mastery] ?? MASTERY_COLORS.blank
      )}
    >
      <div className="line-clamp-2 leading-snug">{topic.title}</div>
      {topic.noteCount > 0 && (
        <div className="mt-1.5 text-[10px] opacity-70">📝 {topic.noteCount}</div>
      )}
    </button>
  );
}

const SOURCE_BADGE: Record<string, string> = {
  manual: "Manual",
  auto_substring: "Auto",
  auto_jaccard: "Fuzzy",
};
const SOURCE_BADGE_COLOR: Record<string, string> = {
  manual: "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15",
  auto_substring: "text-stone-600 bg-stone-100 dark:text-stone-400 dark:bg-stone-800",
  auto_jaccard: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15",
};

function SidePanel({
  topicId,
  onClose,
  onMasteryChange,
  onJumpToNote,
}: {
  topicId: string;
  onClose: () => void;
  onMasteryChange: (mastery: "blank" | "heard" | "learning" | "mastered") => void;
  onJumpToNote: (noteId: string, kind: "learning" | "general", parentId: string | null) => void;
}) {
  const utils = trpc.useUtils();
  const detailQuery = trpc.curriculum.getTopicDetail.useQuery({ topicId });
  const [showLinkPicker, setShowLinkPicker] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const invalidateAll = () => {
    utils.curriculum.getTopicDetail.invalidate({ topicId });
    utils.curriculum.getCurriculum.invalidate();
  };

  const unlink = trpc.curriculum.unlinkNote.useMutation({ onSuccess: invalidateAll });
  const bulkUnlink = trpc.curriculum.bulkUnlink.useMutation({
    onSuccess: () => {
      invalidateAll();
      setSelected(new Set());
      setBulkMode(false);
    },
  });
  const createNote = trpc.curriculum.createNoteForTopic.useMutation({
    onSuccess: ({ noteId, learningTopicId }) => {
      invalidateAll();
      onJumpToNote(noteId, "learning", learningTopicId);
    },
  });

  if (detailQuery.isLoading || !detailQuery.data) {
    return (
      <aside className="fixed right-0 top-0 z-30 h-full w-full sm:w-[380px] border-l border-stone-200 bg-white p-6 dark:border-stone-800 dark:bg-stone-950">
        <div className="text-stone-500 dark:text-stone-400">Loading…</div>
      </aside>
    );
  }

  const { topic, linkedNotes } = detailQuery.data;
  const toggleSelected = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <aside
      className="fixed right-0 top-0 z-30 h-full w-full sm:w-[380px] overflow-y-auto border-l border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950"
      data-testid="topic-side-panel"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold leading-snug text-stone-900 dark:text-stone-100">
          {topic.title}
        </h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-xl leading-none text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
        >
          ×
        </button>
      </div>

      <section className="mb-6">
        <div className="mb-2 text-[11px] uppercase tracking-wide text-stone-500">
          Mastery
        </div>
        <div className="flex gap-1.5" data-testid="mastery-toggle">
          {MASTERY_ORDER.map((state) => (
            <button
              key={state}
              onClick={() => onMasteryChange(state)}
              className={cn(
                "flex-1 rounded border px-2 py-1.5 text-xs transition-colors",
                topic.mastery === state
                  ? MASTERY_COLORS[state]
                  : "border-stone-200 bg-white text-stone-600 hover:border-stone-400 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-500 dark:hover:border-stone-600"
              )}
              data-mastery-option={state}
            >
              {MASTERY_LABELS[state]}
            </button>
          ))}
        </div>
      </section>

      {topic.description && (
        <section className="mb-6">
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-stone-500">
            Description
          </div>
          <p className="whitespace-pre-wrap text-sm text-stone-700 dark:text-stone-300">
            {topic.description}
          </p>
        </section>
      )}

      <section className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wide text-stone-500">
            Linked notes ({linkedNotes.length})
          </div>
          {linkedNotes.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setBulkMode((m) => !m);
                setSelected(new Set());
              }}
              className="text-[11px] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
              data-testid="toggle-bulk-mode"
            >
              {bulkMode ? "Done" : "Select"}
            </button>
          )}
        </div>

        {bulkMode && selected.size > 0 && (
          <button
            type="button"
            onClick={() => {
              const items = Array.from(selected).map((key) => {
                const [kind, id] = key.split("::") as ["learning" | "general", string];
                return { noteId: id, kind };
              });
              bulkUnlink.mutate({ topicId, items });
            }}
            disabled={bulkUnlink.isPending}
            className="mb-2 w-full rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
            data-testid="bulk-unlink"
          >
            Unlink {selected.size} selected
          </button>
        )}

        {linkedNotes.length === 0 ? (
          <p className="text-xs text-stone-500">No notes linked yet.</p>
        ) : (
          <ul className="space-y-1.5" data-testid="linked-notes">
            {linkedNotes.map((n) => {
              const key = `${n.kind}::${n.id}`;
              const isSelected = selected.has(key);
              return (
                <li
                  key={key}
                  className={cn(
                    "flex items-center gap-2 rounded border px-2.5 py-1.5",
                    isSelected
                      ? "border-rose-400 bg-rose-50 dark:border-rose-500/60 dark:bg-rose-500/10"
                      : "border-stone-200 hover:border-stone-400 dark:border-stone-800 dark:hover:border-stone-600"
                  )}
                >
                  {bulkMode && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(key)}
                      className="h-3.5 w-3.5"
                      aria-label={`Select ${n.title}`}
                    />
                  )}
                  <button
                    onClick={() =>
                      bulkMode
                        ? toggleSelected(key)
                        : onJumpToNote(n.id, n.kind, n.parentId)
                    }
                    className="flex-1 truncate text-left text-sm text-stone-800 hover:text-stone-950 dark:text-stone-200 dark:hover:text-stone-50"
                    title={n.title}
                    data-testid="linked-note-link"
                  >
                    {n.title}
                  </button>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px]",
                      SOURCE_BADGE_COLOR[n.source] ?? SOURCE_BADGE_COLOR.auto_substring
                    )}
                    title={`Source: ${n.source}; ${n.kind === "general" ? "General note" : "Learning note"}`}
                  >
                    {SOURCE_BADGE[n.source] ?? "Auto"}
                  </span>
                  {!bulkMode && (
                    <button
                      onClick={() => unlink.mutate({ topicId, noteId: n.id, kind: n.kind })}
                      className="text-xs text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-300"
                      aria-label="Unlink"
                    >
                      ✕
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-2">
        <button
          className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
          onClick={() => setShowLinkPicker(true)}
          data-testid="link-existing-note"
        >
          + Link existing note
        </button>
        <button
          className="w-full rounded border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
          onClick={() => createNote.mutate({ topicId })}
          disabled={createNote.isPending}
          data-testid="create-note-for-topic"
        >
          {createNote.isPending ? "Creating…" : "+ Create new note"}
        </button>
        <Link
          href="/learn"
          className="mt-1 block text-center text-[11px] text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
        >
          Open notebook →
        </Link>
      </div>

      {showLinkPicker && (
        <LinkPicker
          topicId={topicId}
          excludeNoteIds={linkedNotes.filter((n) => n.kind === "learning").map((n) => n.id)}
          onClose={() => setShowLinkPicker(false)}
          onLinked={invalidateAll}
        />
      )}
    </aside>
  );
}

function LinkPicker({
  topicId,
  excludeNoteIds,
  onClose,
  onLinked,
}: {
  topicId: string;
  excludeNoteIds: string[];
  onClose: () => void;
  onLinked: () => void;
}) {
  const [query, setQuery] = useState("");
  const allNotesQuery = trpc.curriculum.searchUserNotes.useQuery(
    { query: query.trim(), limit: 30 },
    { enabled: true }
  );
  const linkMutation = trpc.curriculum.linkNote.useMutation({
    onSuccess: () => onLinked(),
  });

  const excluded = new Set(excludeNoteIds);
  const items = (allNotesQuery.data ?? []).filter((n) => !excluded.has(n.id));

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      data-testid="link-picker"
    >
      <div
        className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-4 shadow-lg dark:border-stone-800 dark:bg-stone-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
            Link existing note
          </h3>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
          >
            ×
          </button>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
          className="mb-3 w-full rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-600 dark:focus:border-stone-500"
          autoFocus
          data-testid="link-picker-search"
        />
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {allNotesQuery.isLoading && (
            <div className="py-2 text-xs text-stone-500">Loading…</div>
          )}
          {!allNotesQuery.isLoading && items.length === 0 && (
            <div className="py-2 text-xs text-stone-500">No matches.</div>
          )}
          {items.map((note) => (
            <button
              key={note.id}
              onClick={() => {
                linkMutation.mutate({ topicId, noteId: note.id, kind: "learning" });
                onClose();
              }}
              className="w-full truncate rounded px-2 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-900"
              title={note.title}
              data-testid="link-picker-item"
            >
              {note.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
