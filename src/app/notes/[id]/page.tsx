"use client";

import { use, useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { ArrowLeft, Save, Tag, X } from "lucide-react";

interface NoteData {
  title: string;
  content: string | null;
  plainText: string | null;
  type: string | null;
  tags: string | null;
}

function NoteEditor({ id, note }: { id: string; note: NoteData }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const updateNote = trpc.notes.update.useMutation({
    onSuccess: () => utils.notes.get.invalidate({ id }),
  });

  const [title, setTitle] = useState(note.title);
  const [type, setType] = useState<"note" | "journal" | "summary">(
    (note.type as "note" | "journal" | "summary") ?? "note"
  );
  const [tags, setTags] = useState<string[]>(note.tags ? JSON.parse(note.tags) : []);
  const [tagInput, setTagInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  const contentRef = useRef({
    content: note.content ?? "",
    plainText: note.plainText ?? "",
  });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSave = useCallback(
    (overrides?: { title?: string; type?: string; tags?: string[] }) => {
      setSaveStatus("saving");
      updateNote.mutate(
        {
          id,
          title: overrides?.title ?? title,
          content: contentRef.current.content,
          plainText: contentRef.current.plainText,
          type: (overrides?.type ?? type) as "note" | "journal" | "summary",
          tags: JSON.stringify(overrides?.tags ?? tags),
        },
        {
          onSuccess: () => setSaveStatus("saved"),
          onError: () => setSaveStatus("unsaved"),
        }
      );
    },
    [id, title, type, tags, updateNote]
  );

  const scheduleAutoSave = useCallback(() => {
    setSaveStatus("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(), 1500);
  }, [doSave]);

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

  const handleTypeChange = (newType: "note" | "journal" | "summary") => {
    setType(newType);
    doSave({ type: newType });
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      const newTags = [...tags, tag];
      setTags(newTags);
      setTagInput("");
      doSave({ tags: newTags });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter((t) => t !== tagToRemove);
    setTags(newTags);
    doSave({ tags: newTags });
  };

  const statusLabel = {
    saved: "已保存",
    saving: "保存中...",
    unsaved: "未保存",
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => router.push("/notes")}
          className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm"
        >
          <ArrowLeft size={16} />
          返回列表
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{statusLabel[saveStatus]}</span>
          <button
            onClick={() => doSave()}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <Save size={14} />
            保存
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="笔记标题"
          className="flex-1 text-2xl font-bold text-gray-900 border-none outline-none bg-transparent placeholder-gray-300"
        />
        <select
          value={type}
          onChange={(e) =>
            handleTypeChange(e.target.value as "note" | "journal" | "summary")
          }
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="note">笔记</option>
          <option value="journal">日记</option>
          <option value="summary">总结</option>
        </select>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Tag size={14} className="text-gray-400" />
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded"
          >
            {tag}
            <button
              onClick={() => handleRemoveTag(tag)}
              className="hover:text-red-500"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddTag();
            }
          }}
          placeholder="添加标签..."
          className="text-sm border-none outline-none bg-transparent placeholder-gray-300 w-24"
        />
      </div>

      <TiptapEditor
        content={note.content ?? undefined}
        onChange={handleContentChange}
      />
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
    return <p className="text-gray-500">加载中...</p>;
  }

  if (!note) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">笔记不存在</p>
        <button
          onClick={() => router.push("/notes")}
          className="mt-4 text-blue-600 hover:underline"
        >
          返回笔记列表
        </button>
      </div>
    );
  }

  return <NoteEditor id={id} note={note} />;
}
