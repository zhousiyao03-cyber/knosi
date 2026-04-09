"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link as LinkIcon, Share2 } from "lucide-react";
import { KnowledgeNoteEditor } from "@/components/editor/knowledge-note-editor";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function ProjectNoteSharePopover({
  noteId,
  shareToken,
}: {
  noteId: string;
  shareToken: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const enableShare = trpc.ossProjects.enableNoteShare.useMutation({
    onSuccess: () => utils.ossProjects.getNote.invalidate({ id: noteId }),
  });
  const disableShare = trpc.ossProjects.disableNoteShare.useMutation({
    onSuccess: () => utils.ossProjects.getNote.invalidate({ id: noteId }),
  });

  const shareUrl = shareToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/project-note/${shareToken}`
    : null;

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (popoverRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={popoverRef} className="relative">
      <button
        type="button"
        data-testid="project-note-share-button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm transition-colors sm:px-3 sm:text-xs",
          shareToken
            ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900/80 dark:bg-blue-950/50 dark:text-blue-200 dark:hover:bg-blue-900/60"
            : "border-stone-200 bg-white/80 text-stone-500 hover:bg-stone-100 hover:text-stone-700 dark:border-stone-800 dark:bg-stone-950/80 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-stone-200"
        )}
      >
        <Share2 size={13} />
        {shareToken ? "Shared" : "Share"}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-[340px] rounded-2xl border border-stone-200/90 bg-white/96 p-4 shadow-[0_22px_64px_rgba(15,23,42,0.18)] backdrop-blur dark:border-stone-800 dark:bg-stone-950/96">
          {shareToken ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-stone-200">
                <LinkIcon size={14} className="text-blue-500" />
                Link sharing is on
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareUrl ?? ""}
                  className="flex-1 truncate rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800"
                >
                  {copied ? (
                    <Check size={13} className="text-emerald-500" />
                  ) : (
                    <Copy size={13} />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  disableShare.mutate({ id: noteId });
                  setOpen(false);
                }}
                disabled={disableShare.isPending}
                className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/80 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/60"
              >
                Disable sharing
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm text-stone-500 dark:text-stone-400">
                Anyone with the link can view this project note (read-only).
              </div>
              <button
                type="button"
                onClick={() => enableShare.mutate({ id: noteId })}
                disabled={enableShare.isPending}
                className="w-full rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
              >
                {enableShare.isPending ? "Enabling..." : "Enable link sharing"}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function ProjectNotePage({
  params,
}: {
  params: Promise<{ id: string; noteId: string }>;
}) {
  const { id, noteId } = use(params);
  const router = useRouter();
  const utils = trpc.useUtils();
  const { data: note, isLoading } = trpc.ossProjects.getNote.useQuery({ id: noteId });
  const updateNote = trpc.ossProjects.updateNote.useMutation();

  if (isLoading) {
    return <div className="py-12 text-sm text-stone-500">Loading note...</div>;
  }

  if (!note) {
    return (
      <div className="py-12 text-center text-stone-500">
        <p>Note not found.</p>
        <button
          type="button"
          onClick={() => router.push(`/projects/${id}?view=overview`)}
          className="mt-4 text-blue-600 hover:underline"
        >
          Back to project
        </button>
      </div>
    );
  }

  return (
    <div>
      <KnowledgeNoteEditor
        noteId={noteId}
        note={note}
        backHref={`/projects/${id}?view=overview`}
        backLabel="Back to project"
        headerActions={
          <ProjectNoteSharePopover
            noteId={noteId}
            shareToken={
              (note as { shareToken?: string | null }).shareToken ?? null
            }
          />
        }
        onSave={async (payload) => {
          await updateNote.mutateAsync({
            id: payload.id,
            projectId: id,
            title: payload.title,
            content: payload.content,
            plainText: payload.plainText,
            tags: payload.tags,
          });
          await Promise.all([
            utils.ossProjects.getNote.invalidate({ id: noteId }),
            utils.ossProjects.getProject.invalidate({ id }),
            utils.ossProjects.listNotes.invalidate({ projectId: id }),
          ]);
        }}
      />
    </div>
  );
}
