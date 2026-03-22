"use client";

import { useState, useCallback, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Typography from "@tiptap/extension-typography";
import { common, createLowlight } from "lowlight";
import {
  createSlashCommandExtension,
  SlashCommandMenu,
} from "./slash-command";
import { BubbleToolbar } from "./bubble-toolbar";

const lowlight = createLowlight(common);

interface TiptapEditorProps {
  content?: string;
  onChange?: (content: string, plainText: string) => void;
  editable?: boolean;
  placeholder?: string;
}

export function TiptapEditor({
  content,
  onChange,
  editable = true,
  placeholder = "输入 / 以插入命令...",
}: TiptapEditorProps) {
  const [slashCoords, setSlashCoords] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [slashQuery, setSlashQuery] = useState("");

  const handleSlashActivate = useCallback(
    (query: string, coords: { top: number; left: number }) => {
      setSlashQuery(query);
      setSlashCoords(coords);
    },
    []
  );

  const handleSlashDeactivate = useCallback(() => {
    setSlashCoords(null);
    setSlashQuery("");
  }, []);

  const handleSlashQueryChange = useCallback((query: string) => {
    setSlashQuery(query);
  }, []);

  const slashCommandExtension = useMemo(
    () =>
      createSlashCommandExtension(
        handleSlashActivate,
        handleSlashDeactivate,
        handleSlashQueryChange
      ),
    [handleSlashActivate, handleSlashDeactivate, handleSlashQueryChange]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") {
            return `标题 ${node.attrs.level}`;
          }
          return placeholder;
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: false }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-blue-600 underline cursor-pointer" },
      }),
      CodeBlockLowlight.configure({ lowlight }),
      Typography,
      slashCommandExtension,
    ],
    content: content ? JSON.parse(content) : undefined,
    editable,
    onUpdate: ({ editor }) => {
      const json = JSON.stringify(editor.getJSON());
      const text = editor.getText();
      onChange?.(json, text);
    },
    editorProps: {
      attributes: {
        class: "notion-editor focus:outline-none min-h-[60vh] px-1 py-2",
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="relative">
      {editable && <BubbleToolbar editor={editor} />}

      <EditorContent editor={editor} />

      {slashCoords && (
        <SlashCommandMenu
          key={slashQuery}
          editor={editor}
          coords={slashCoords}
          query={slashQuery}
          onClose={handleSlashDeactivate}
        />
      )}
    </div>
  );
}
