"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

// ───── Track ─────

export function NewTrackButton() {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("📚");
  const create = trpc.curriculum.createTrack.useMutation({
    onSuccess: () => {
      utils.curriculum.getCurriculum.invalidate();
      setOpen(false);
      setTitle("");
      setIcon("📚");
    },
  });
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-dashed border-stone-300 px-3 py-1.5 text-sm text-stone-500 hover:border-stone-500 hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-500 dark:hover:text-stone-200"
        data-testid="new-track-button"
      >
        + New track
      </button>
      {open && (
        <Modal title="New track" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-stone-500">
                Icon
              </label>
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="mt-1 w-20 rounded border border-stone-300 bg-white px-2 py-1 text-center text-lg dark:border-stone-700 dark:bg-stone-900"
                maxLength={4}
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-stone-500">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Frontend Specialist"
                className="mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                className="rounded border border-stone-300 px-3 py-1 text-xs dark:border-stone-700"
              >
                Cancel
              </button>
              <button
                onClick={() => title.trim() && create.mutate({ title: title.trim(), icon })}
                disabled={!title.trim() || create.isPending}
                className="rounded bg-stone-900 px-3 py-1 text-xs text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
              >
                {create.isPending ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ───── Area ─────

export function NewAreaButton({ trackId }: { trackId: string }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const create = trpc.curriculum.createArea.useMutation({
    onSuccess: () => {
      utils.curriculum.getCurriculum.invalidate();
      setOpen(false);
      setTitle("");
    },
  });
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
        data-testid="new-area-button"
      >
        + Add area
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) create.mutate({ trackId, title: title.trim() });
      }}
      className="flex items-center gap-2"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Area name"
        className="rounded border border-stone-300 bg-white px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-900"
      />
      <button
        type="submit"
        disabled={!title.trim() || create.isPending}
        className="rounded bg-stone-900 px-2 py-1 text-xs text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
      >
        Add
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setTitle("");
        }}
        className="text-xs text-stone-500"
      >
        Cancel
      </button>
    </form>
  );
}

export function AreaActions({
  areaId,
  title,
  onRenamed,
}: {
  areaId: string;
  title: string;
  onRenamed?: () => void;
}) {
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(title);

  const update = trpc.curriculum.updateArea.useMutation({
    onSuccess: () => {
      utils.curriculum.getCurriculum.invalidate();
      setEditing(false);
      onRenamed?.();
    },
  });
  const del = trpc.curriculum.deleteArea.useMutation({
    onSuccess: () => utils.curriculum.getCurriculum.invalidate(),
  });

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newTitle.trim() && newTitle.trim() !== title) {
            update.mutate({ id: areaId, title: newTitle.trim() });
          } else {
            setEditing(false);
          }
        }}
        className="inline-flex items-center gap-1"
      >
        <input
          autoFocus
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onBlur={() => setEditing(false)}
          className="rounded border border-stone-300 bg-white px-2 py-0.5 text-sm dark:border-stone-700 dark:bg-stone-900"
        />
      </form>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-stone-400">
      <button
        type="button"
        onClick={() => {
          setNewTitle(title);
          setEditing(true);
        }}
        title="Rename area"
        className="text-xs hover:text-stone-700 dark:hover:text-stone-200"
      >
        ✏️
      </button>
      <button
        type="button"
        onClick={() => {
          if (
            confirm(`Delete area "${title}"? All topics inside it will be removed.`)
          ) {
            del.mutate({ id: areaId });
          }
        }}
        title="Delete area"
        className="text-xs hover:text-rose-600"
      >
        🗑
      </button>
    </span>
  );
}

// ───── Topic add (inline at end of area grid) ─────

export function NewTopicInline({ areaId }: { areaId: string }) {
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const create = trpc.curriculum.createTopic.useMutation({
    onSuccess: () => {
      utils.curriculum.getCurriculum.invalidate();
      setTitle("");
      setEditing(false);
    },
  });

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-md border border-dashed border-stone-300 px-3 py-2.5 text-left text-xs text-stone-500 hover:border-stone-500 hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-500"
        data-testid="new-topic-button"
      >
        + Add topic
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) create.mutate({ areaId, title: title.trim() });
      }}
      className="rounded-md border border-stone-300 bg-white px-2 py-1.5 dark:border-stone-700 dark:bg-stone-900"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (!title.trim()) setEditing(false);
        }}
        placeholder="Topic title"
        className="w-full bg-transparent text-xs outline-none placeholder:text-stone-400"
      />
    </form>
  );
}

// ───── Topic edit/delete (used inside SidePanel) ─────

export function TopicEditActions({
  topicId,
  title,
  onDeleted,
}: {
  topicId: string;
  title: string;
  onDeleted: () => void;
}) {
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(title);

  const update = trpc.curriculum.updateTopic.useMutation({
    onSuccess: () => {
      utils.curriculum.getTopicDetail.invalidate({ topicId });
      utils.curriculum.getCurriculum.invalidate();
      setEditing(false);
    },
  });
  const del = trpc.curriculum.deleteTopic.useMutation({
    onSuccess: () => {
      utils.curriculum.getCurriculum.invalidate();
      onDeleted();
    },
  });

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newTitle.trim() && newTitle.trim() !== title) {
            update.mutate({ id: topicId, title: newTitle.trim() });
          } else {
            setEditing(false);
          }
        }}
        className="mb-3"
      >
        <input
          autoFocus
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          className="w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-base font-semibold dark:border-stone-700 dark:bg-stone-900"
          data-testid="topic-edit-input"
        />
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setNewTitle(title);
          setEditing(true);
        }}
        className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
        title="Rename"
        data-testid="topic-edit-rename"
      >
        Rename
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm(`Delete topic "${title}"? Linked notes are kept.`)) {
            del.mutate({ id: topicId });
          }
        }}
        className="text-xs text-rose-600 hover:text-rose-800"
        data-testid="topic-edit-delete"
      >
        Delete
      </button>
    </div>
  );
}

// ───── Editable description block (used inside SidePanel) ─────

export function EditableDescription({
  topicId,
  description,
}: {
  topicId: string;
  description: string | null | undefined;
}) {
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description ?? "");

  const save = trpc.curriculum.setTopicDescription.useMutation({
    onSuccess: () => {
      utils.curriculum.getTopicDetail.invalidate({ topicId });
      setEditing(false);
    },
  });

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ topicId, description: draft.trim() });
        }}
      >
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          className="w-full rounded border border-stone-300 bg-white p-2 text-sm dark:border-stone-700 dark:bg-stone-900"
          placeholder="Topic description (markdown allowed)"
          data-testid="description-textarea"
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft(description ?? "");
              setEditing(false);
            }}
            className="rounded border border-stone-300 px-2 py-1 text-xs dark:border-stone-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded bg-stone-900 px-2 py-1 text-xs text-white disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
          >
            Save
          </button>
        </div>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(description ?? "");
        setEditing(true);
      }}
      className="block w-full text-left"
      title="Click to edit"
      data-testid="description-edit-trigger"
    >
      {description ? (
        <p className="whitespace-pre-wrap text-sm text-stone-700 hover:text-stone-900 dark:text-stone-300 dark:hover:text-stone-100">
          {description}
        </p>
      ) : (
        <p className="text-xs italic text-stone-400 hover:text-stone-600 dark:hover:text-stone-300">
          No description yet — click to add one.
        </p>
      )}
    </button>
  );
}

// ───── Generate description (used inside SidePanel) ─────

export function GenerateDescriptionButton({ topicId }: { topicId: string }) {
  const utils = trpc.useUtils();
  const generate = trpc.curriculum.generateDescription.useMutation({
    onSuccess: () => {
      utils.curriculum.getTopicDetail.invalidate({ topicId });
    },
  });
  return (
    <button
      type="button"
      onClick={() => generate.mutate({ topicId })}
      disabled={generate.isPending}
      className="text-xs text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline disabled:opacity-50 dark:hover:text-stone-200"
      data-testid="generate-description"
    >
      {generate.isPending ? "Generating…" : "Generate description"}
    </button>
  );
}

// ───── Plain modal ─────

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          "w-full max-w-md rounded-lg border border-stone-200 bg-white p-4 shadow-lg",
          "dark:border-stone-800 dark:bg-stone-950"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-800">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
