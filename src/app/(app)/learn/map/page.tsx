"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  blank: "border-zinc-700/40 bg-transparent text-zinc-500 hover:border-zinc-500",
  heard: "border-sky-500/40 bg-sky-500/10 text-sky-200 hover:border-sky-400",
  learning: "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:border-amber-400",
  mastered: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:border-emerald-400",
};

const MASTERY_DOT: Record<string, string> = {
  blank: "bg-zinc-600",
  heard: "bg-sky-400",
  learning: "bg-amber-400",
  mastered: "bg-emerald-400",
};

const MASTERY_ORDER = ["blank", "heard", "learning", "mastered"] as const;

type CurriculumData = RouterOutputs["curriculum"]["getCurriculum"];
type Track = CurriculumData["tracks"][number];
type Topic = Track["areas"][number]["topics"][number];

export default function CurriculumMapPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const curriculumQuery = trpc.curriculum.getCurriculum.useQuery();

  const [explicitTrackId, setExplicitTrackId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

  const tracks = curriculumQuery.data?.tracks ?? [];

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
      <div className="p-8 text-zinc-400">
        <div className="text-lg">Setting up your curriculum…</div>
        <div className="text-sm mt-2 text-zinc-500">
          First visit triggers seed and auto-link of existing notes. This takes a few seconds.
        </div>
      </div>
    );
  }

  if (!activeTrack) {
    return (
      <div className="p-8 text-zinc-400">
        <div>No curriculum yet.</div>
        <button
          className="mt-4 px-3 py-1.5 rounded border border-zinc-700 hover:border-zinc-500 text-sm"
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
            <h1 className="text-2xl font-semibold text-zinc-100">Curriculum Map</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Your knowledge gap analysis across target roles.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 rounded border border-zinc-700 hover:border-zinc-500 text-xs text-zinc-300"
              onClick={() => rerunMutation.mutate()}
              disabled={rerunMutation.isPending}
              data-testid="rerun-autolink"
            >
              {rerunMutation.isPending ? "Linking…" : "Re-link notes"}
            </button>
            <button
              className="px-3 py-1.5 rounded border border-zinc-700 hover:border-zinc-500 text-xs text-zinc-300"
              onClick={onResetClick}
              disabled={resetMutation.isPending}
              data-testid="reset-curriculum"
            >
              Reset
            </button>
          </div>
        </header>

        <nav className="mb-6 flex items-center gap-2" data-testid="track-tabs">
          {tracks.map((track) => (
            <button
              key={track.id}
              onClick={() => setExplicitTrackId(track.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm border transition-colors",
                track.id === activeTrack.id
                  ? "border-zinc-500 bg-zinc-800 text-zinc-100"
                  : "border-zinc-800 text-zinc-400 hover:border-zinc-600"
              )}
              data-track-id={track.id}
            >
              <span className="mr-1.5">{track.icon}</span>
              {track.title}
            </button>
          ))}
        </nav>

        <div className="mb-8 flex items-center gap-4 text-xs text-zinc-400">
          <Stat label="Mastered" value={stats.mastered} total={stats.total} dotClass={MASTERY_DOT.mastered} />
          <Stat label="Learning" value={stats.learning} total={stats.total} dotClass={MASTERY_DOT.learning} />
          <Stat label="Heard" value={stats.heard} total={stats.total} dotClass={MASTERY_DOT.heard} />
          <Stat label="Total" value={stats.total} total={stats.total} dotClass={MASTERY_DOT.blank} />
        </div>

        <div className="space-y-8">
          {activeTrack.areas.map((area) => (
            <section key={area.id} data-area-id={area.id}>
              <h2 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wide">
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
        <SidePanel
          topicId={selectedTopicId}
          onClose={() => setSelectedTopicId(null)}
          onMasteryChange={(mastery) =>
            setMastery.mutate({ topicId: selectedTopicId, mastery })
          }
          onJumpToNote={(noteId, learningTopicId) => {
            setSelectedTopicId(null);
            router.push(`/learn/${learningTopicId}/${noteId}`);
          }}
        />
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
      <span className="text-zinc-300">{label}</span>
      <span className="text-zinc-500">
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

function SidePanel({
  topicId,
  onClose,
  onMasteryChange,
  onJumpToNote,
}: {
  topicId: string;
  onClose: () => void;
  onMasteryChange: (mastery: "blank" | "heard" | "learning" | "mastered") => void;
  onJumpToNote: (noteId: string, learningTopicId: string) => void;
}) {
  const utils = trpc.useUtils();
  const detailQuery = trpc.curriculum.getTopicDetail.useQuery({ topicId });
  const [showLinkPicker, setShowLinkPicker] = useState(false);

  const unlink = trpc.curriculum.unlinkNote.useMutation({
    onSuccess: () => {
      utils.curriculum.getTopicDetail.invalidate({ topicId });
      utils.curriculum.getCurriculum.invalidate();
    },
  });
  const createNote = trpc.curriculum.createNoteForTopic.useMutation({
    onSuccess: ({ noteId, learningTopicId }) => {
      utils.curriculum.getTopicDetail.invalidate({ topicId });
      utils.curriculum.getCurriculum.invalidate();
      onJumpToNote(noteId, learningTopicId);
    },
  });

  if (detailQuery.isLoading || !detailQuery.data) {
    return (
      <aside className="fixed right-0 top-0 z-30 h-full w-[380px] border-l border-zinc-800 bg-zinc-950 p-6">
        <div className="text-zinc-400">Loading…</div>
      </aside>
    );
  }

  const { topic, linkedNotes } = detailQuery.data;

  return (
    <aside
      className="fixed right-0 top-0 z-30 h-full w-[380px] border-l border-zinc-800 bg-zinc-950 p-5 overflow-y-auto"
      data-testid="topic-side-panel"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 className="text-base font-semibold text-zinc-100 leading-snug">{topic.title}</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-zinc-500 hover:text-zinc-300 text-xl leading-none"
        >
          ×
        </button>
      </div>

      <section className="mb-6">
        <div className="text-[11px] uppercase tracking-wide text-zinc-500 mb-2">Mastery</div>
        <div className="flex gap-1.5" data-testid="mastery-toggle">
          {MASTERY_ORDER.map((state) => (
            <button
              key={state}
              onClick={() => onMasteryChange(state)}
              className={cn(
                "flex-1 rounded border px-2 py-1.5 text-xs transition-colors",
                topic.mastery === state
                  ? MASTERY_COLORS[state]
                  : "border-zinc-800 text-zinc-500 hover:border-zinc-600"
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
          <div className="text-[11px] uppercase tracking-wide text-zinc-500 mb-1.5">Description</div>
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{topic.description}</p>
        </section>
      )}

      <section className="mb-4">
        <div className="text-[11px] uppercase tracking-wide text-zinc-500 mb-2">
          Linked notes ({linkedNotes.length})
        </div>
        {linkedNotes.length === 0 ? (
          <p className="text-xs text-zinc-500">No notes linked yet.</p>
        ) : (
          <ul className="space-y-1.5" data-testid="linked-notes">
            {linkedNotes.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between gap-2 rounded border border-zinc-800 px-2.5 py-1.5 hover:border-zinc-600"
              >
                <button
                  onClick={() => onJumpToNote(n.id, n.topicId)}
                  className="flex-1 text-left text-sm text-zinc-200 truncate"
                  title={n.title}
                  data-testid="linked-note-link"
                >
                  {n.title}
                </button>
                <button
                  onClick={() => unlink.mutate({ topicId, noteId: n.id })}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                  aria-label="Unlink"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-2">
        <button
          className="w-full rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-zinc-500"
          onClick={() => setShowLinkPicker(true)}
          data-testid="link-existing-note"
        >
          + Link existing note
        </button>
        <button
          className="w-full rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:border-zinc-500"
          onClick={() => createNote.mutate({ topicId })}
          disabled={createNote.isPending}
          data-testid="create-note-for-topic"
        >
          {createNote.isPending ? "Creating…" : "+ Create new note"}
        </button>
        <Link
          href="/learn"
          className="block text-center text-[11px] text-zinc-500 hover:text-zinc-300 mt-1"
        >
          Open notebook →
        </Link>
      </div>

      {showLinkPicker && (
        <LinkPicker
          topicId={topicId}
          excludeNoteIds={linkedNotes.map((n) => n.id)}
          onClose={() => setShowLinkPicker(false)}
          onLinked={() => {
            utils.curriculum.getTopicDetail.invalidate({ topicId });
            utils.curriculum.getCurriculum.invalidate();
          }}
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
        className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-950 p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-100">Link existing note</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">×</button>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
          className="w-full mb-3 rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          autoFocus
          data-testid="link-picker-search"
        />
        <div className="max-h-64 overflow-y-auto space-y-1">
          {allNotesQuery.isLoading && (
            <div className="text-xs text-zinc-500 py-2">Loading…</div>
          )}
          {!allNotesQuery.isLoading && items.length === 0 && (
            <div className="text-xs text-zinc-500 py-2">No matches.</div>
          )}
          {items.map((note) => (
            <button
              key={note.id}
              onClick={() => {
                linkMutation.mutate({ topicId, noteId: note.id });
                onClose();
              }}
              className="w-full text-left rounded px-2 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900 truncate"
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
