"use client";

import { use, useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, Tag, X } from "lucide-react";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { useToast } from "@/components/ui/toast";
import { trpc } from "@/lib/trpc";
import { cn, formatDate } from "@/lib/utils";
import {
  NOTE_TYPE_LABELS,
  getNoteCoverOption,
} from "@/lib/note-appearance";

interface NoteData {
  title: string;
  content: string | null;
  plainText: string | null;
  type: "note" | "journal" | "summary" | null;
  icon: string | null;
  cover: string | null;
  tags: string | null;
  updatedAt: Date | null;
}

interface SaveOverrides {
  title?: string;
  type?: "note" | "journal" | "summary";
  tags?: string[];
  cover?: string | null;
}

const MAX_COVER_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_COVER_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function parseTags(tags: string | null | undefined) {
  if (!tags) return [] as string[];

  try {
    const value = JSON.parse(tags);
    return Array.isArray(value)
      ? value.filter((tag): tag is string => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}

function validateCoverFile(file: File) {
  if (!ACCEPTED_COVER_TYPES.has(file.type)) {
    return "当前只支持 PNG、JPG、WEBP 和 GIF 图片。";
  }

  if (file.size > MAX_COVER_FILE_SIZE) {
    return "封面图片不能超过 5MB。";
  }

  return null;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("图片读取失败"));
    };

    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function isImageCover(cover: string | null | undefined) {
  if (!cover) return false;

  return cover.startsWith("data:image/") || /^https?:\/\//.test(cover);
}

function NoteEditor({ id, note }: { id: string; note: NoteData }) {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const updateNote = trpc.notes.update.useMutation({
    onSuccess: () => utils.notes.get.invalidate({ id }),
  });

  const [title, setTitle] = useState(note.title);
  const [type, setType] = useState<"note" | "journal" | "summary">(
    note.type ?? "note"
  );
  const [cover, setCover] = useState<string | null>(note.cover);
  const [tags, setTags] = useState<string[]>(parseTags(note.tags));
  const [tagInput, setTagInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    "saved"
  );
  const [lastEditedAt, setLastEditedAt] = useState<Date | null>(
    note.updatedAt ? new Date(note.updatedAt) : null
  );

  const contentRef = useRef({
    content: note.content ?? "",
    plainText: note.plainText ?? "",
  });
  const coverInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSave = useCallback(
    (overrides?: SaveOverrides) => {
      setSaveStatus("saving");
      updateNote.mutate(
        {
          id,
          title: overrides?.title ?? title,
          content: contentRef.current.content,
          plainText: contentRef.current.plainText,
          type: overrides?.type ?? type,
          icon: note.icon,
          cover: overrides?.cover ?? cover,
          tags: JSON.stringify(overrides?.tags ?? tags),
        },
        {
          onSuccess: () => {
            setSaveStatus("saved");
            setLastEditedAt(new Date());
          },
          onError: () => setSaveStatus("unsaved"),
        }
      );
    },
    [cover, id, note.icon, tags, title, type, updateNote]
  );

  const scheduleAutoSave = useCallback(() => {
    setSaveStatus("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(), 1500);
  }, [doSave]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    []
  );

  const handleContentChange = useCallback(
    (content: string, plainText: string) => {
      contentRef.current = { content, plainText };
      scheduleAutoSave();
    },
    [scheduleAutoSave]
  );

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setSaveStatus("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave({ title: newTitle }), 1500);
  };

  const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    const editorEl = document.querySelector(".notion-editor") as HTMLElement | null;
    editorEl?.focus();
  };

  const handleTypeChange = (newType: "note" | "journal" | "summary") => {
    setType(newType);
    doSave({ type: newType });
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (!tag || tags.includes(tag)) return;

    const newTags = [...tags, tag];
    setTags(newTags);
    setTagInput("");
    doSave({ tags: newTags });
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(newTags);
    doSave({ tags: newTags });
  };

  const handleCoverChange = (nextCover: string | null) => {
    setCover(nextCover);
    doSave({ cover: nextCover });
  };

  const handleSelectCover = () => {
    coverInputRef.current?.click();
  };

  const handleCoverFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const error = validateCoverFile(file);
    if (error) {
      toast(error, "error");
      return;
    }

    try {
      const source = await readFileAsDataUrl(file);
      handleCoverChange(source);
    } catch {
      toast("图片读取失败", "error");
    }
  };

  const coverOption = getNoteCoverOption(cover);
  const coverUsesImage = isImageCover(cover);

  const statusDot = {
    saved: "bg-emerald-400",
    saving: "bg-amber-400 animate-pulse",
    unsaved: "bg-stone-300 dark:bg-stone-600",
  };

  return (
    <div className="mx-auto w-full max-w-[1040px] px-6 pb-10 pt-5 md:px-10">
      <div className="mb-4 flex items-center justify-between gap-4">
        <button
          onClick={() => router.push("/notes")}
          data-testid="note-editor-back"
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-stone-100"
        >
          <ArrowLeft size={16} />
          返回笔记
        </button>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {lastEditedAt && (
            <span className="rounded-full border border-stone-200 bg-white/80 px-3 py-1 text-xs text-stone-500 shadow-sm dark:border-stone-800 dark:bg-stone-950/80 dark:text-stone-400">
              编辑于 {formatDate(lastEditedAt)}
            </span>
          )}
          <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-3 py-1 text-xs text-stone-500 shadow-sm dark:border-stone-800 dark:bg-stone-950/80 dark:text-stone-400">
            <span className={cn("h-2 w-2 rounded-full", statusDot[saveStatus])} />
            {saveStatus === "saved"
              ? "已保存"
              : saveStatus === "saving"
                ? "保存中..."
                : "正在编辑"}
          </span>
        </div>
      </div>

      <div
        data-testid="note-cover-header"
        className={cn(
          "group relative mb-4 overflow-hidden rounded-[32px] transition-all",
          cover
            ? "h-[260px] bg-stone-100 shadow-sm dark:bg-stone-900"
            : "h-24 border border-dashed border-stone-200/80 bg-stone-50/70 dark:border-stone-800 dark:bg-stone-950/60"
        )}
      >
        {coverUsesImage && (
          <img
            src={cover ?? ""}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {!coverUsesImage && coverOption && (
          <>
            <div className={cn("absolute inset-0", coverOption.bannerClassName)} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.45),transparent_35%)]" />
          </>
        )}

        {(coverUsesImage || coverOption) && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/8 via-transparent to-black/18" />
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <div className="flex items-center gap-2 opacity-0 transition-all group-hover:opacity-100">
            <button
              type="button"
              onClick={handleSelectCover}
              data-testid="note-add-cover"
              className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/88 px-3 py-1.5 text-sm text-stone-700 shadow-sm backdrop-blur transition-colors hover:bg-white dark:border-stone-700 dark:bg-stone-950/85 dark:text-stone-200 dark:hover:bg-stone-950"
            >
              <ImagePlus size={14} />
              {cover ? "更换图片" : "插入图片"}
            </button>

            {cover && (
              <button
                type="button"
                onClick={() => handleCoverChange(null)}
                data-testid="note-remove-cover"
                className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/88 px-3 py-1.5 text-sm text-stone-700 shadow-sm backdrop-blur transition-colors hover:bg-white dark:border-stone-700 dark:bg-stone-950/85 dark:text-stone-200 dark:hover:bg-stone-950"
              >
                <X size={14} />
                移除封面
              </button>
            )}
          </div>
        </div>
      </div>

      <input
        ref={coverInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        data-testid="note-cover-input"
        className="hidden"
        onChange={handleCoverFileChange}
      />

      <div
        data-testid="page-properties"
        className="mb-3 flex flex-wrap items-center gap-3 px-1 text-sm text-stone-500 dark:text-stone-400"
      >
        <div className="flex flex-wrap items-center gap-2">
          {(Object.entries(NOTE_TYPE_LABELS) as Array<
            [keyof typeof NOTE_TYPE_LABELS, string]
          >).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => handleTypeChange(value)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                type === value
                  ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950"
                  : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-300 dark:hover:border-stone-700 dark:hover:text-stone-100"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="hidden h-4 w-px bg-stone-200 dark:bg-stone-800 md:block" />

        <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-sm text-blue-700 dark:border-blue-900/80 dark:bg-blue-950/50 dark:text-blue-200"
            >
              <Tag size={12} />
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="rounded-full px-1 text-blue-500 transition-colors hover:bg-blue-100 hover:text-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/70 dark:hover:text-blue-100"
                aria-label={`移除标签 ${tag}`}
              >
                ×
              </button>
            </span>
          ))}

          <input
            type="text"
            value={tagInput}
            data-testid="note-tag-input"
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              handleAddTag();
            }}
            onBlur={() => {
              if (tagInput.trim()) handleAddTag();
            }}
            placeholder="添加标签..."
            className="min-w-28 rounded-full border border-dashed border-stone-200 bg-transparent px-3 py-1 text-sm text-stone-600 outline-none transition-colors placeholder:text-stone-400 focus:border-stone-300 dark:border-stone-700 dark:text-stone-300 dark:placeholder:text-stone-500 dark:focus:border-stone-600"
          />
        </div>
      </div>

      {note.icon && (
        <div className={cn("mb-3 px-1", cover && "-mt-12")}>
          <div className="inline-flex h-18 w-18 items-center justify-center rounded-[22px] border border-white/80 bg-white/95 text-4xl shadow-lg backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
            {note.icon}
          </div>
        </div>
      )}

      <div className="mb-6 px-1">
        <textarea
          value={title}
          onChange={(event) => handleTitleChange(event.target.value)}
          onKeyDown={handleTitleKeyDown}
          placeholder="无标题"
          rows={1}
          className="w-full resize-none border-none bg-transparent text-[3.15rem] font-semibold leading-[1.04] text-stone-900 outline-none placeholder:text-stone-300 dark:text-stone-100 dark:placeholder:text-stone-600 md:text-[3.5rem]"
          style={{ overflow: "hidden" }}
          onInput={(event) => {
            const target = event.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = `${target.scrollHeight}px`;
          }}
        />
      </div>

      <div className="px-1">
        <TiptapEditor
          content={note.content ?? undefined}
          onChange={handleContentChange}
          onError={(message) => toast(message, "error")}
        />
      </div>
    </div>
  );
}

export default function NoteEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: note, isLoading } = trpc.notes.get.useQuery({ id });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl py-20 text-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-stone-200 border-t-stone-600 dark:border-stone-700 dark:border-t-stone-200" />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="py-12 text-center">
        <p className="text-stone-500 dark:text-stone-400">笔记不存在</p>
        <button
          onClick={() => router.push("/notes")}
          className="mt-4 text-blue-600 hover:underline"
        >
          返回笔记列表
        </button>
      </div>
    );
  }

  return <NoteEditor key={id} id={id} note={note} />;
}
