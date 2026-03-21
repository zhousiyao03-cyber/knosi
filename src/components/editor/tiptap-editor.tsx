"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo,
  Redo,
} from "lucide-react";

interface TiptapEditorProps {
  content?: string;
  onChange?: (content: string, plainText: string) => void;
  editable?: boolean;
  placeholder?: string;
}

function ToolbarButton({
  onClick,
  isActive,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded hover:bg-gray-200 transition-colors",
        isActive && "bg-gray-200 text-blue-600"
      )}
    >
      {children}
    </button>
  );
}

export function TiptapEditor({
  content,
  onChange,
  editable = true,
  placeholder = "开始写点什么...",
}: TiptapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder }),
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
        class: "prose prose-sm max-w-none focus:outline-none min-h-[300px] px-4 py-3",
      },
    },
  });

  if (!editor) return null;

  const iconSize = 16;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {editable && (
        <div className="flex items-center gap-0.5 p-1.5 border-b border-gray-200 bg-gray-50 flex-wrap">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor.isActive("heading", { level: 1 })}
            title="标题 1"
          >
            <Heading1 size={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive("heading", { level: 2 })}
            title="标题 2"
          >
            <Heading2 size={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive("heading", { level: 3 })}
            title="标题 3"
          >
            <Heading3 size={iconSize} />
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-300 mx-1" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive("bold")}
            title="粗体"
          >
            <Bold size={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive("italic")}
            title="斜体"
          >
            <Italic size={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive("strike")}
            title="删除线"
          >
            <Strikethrough size={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive("code")}
            title="行内代码"
          >
            <Code size={iconSize} />
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-300 mx-1" />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive("bulletList")}
            title="无序列表"
          >
            <List size={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive("orderedList")}
            title="有序列表"
          >
            <ListOrdered size={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive("blockquote")}
            title="引用"
          >
            <Quote size={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="分割线"
          >
            <Minus size={iconSize} />
          </ToolbarButton>

          <div className="w-px h-5 bg-gray-300 mx-1" />

          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            title="撤销"
          >
            <Undo size={iconSize} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            title="重做"
          >
            <Redo size={iconSize} />
          </ToolbarButton>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
