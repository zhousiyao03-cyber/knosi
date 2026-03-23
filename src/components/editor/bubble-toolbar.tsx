"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Highlighter,
  Link as LinkIcon,
} from "lucide-react";

function BubbleButton({
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
      onMouseDown={(e) => {
        e.preventDefault(); // prevent losing selection
        onClick();
      }}
      title={title}
      className={cn(
        "p-1.5 rounded hover:bg-white/20 transition-colors",
        isActive && "bg-white/20 text-white"
      )}
    >
      {children}
    </button>
  );
}

interface BubbleToolbarProps {
  editor: Editor;
}

export function BubbleToolbar({ editor }: BubbleToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const { from, to, empty } = editor.state.selection;
    if (empty) {
      setVisible(false);
      return;
    }

    // Don't show in code blocks
    if (editor.isActive("codeBlock")) {
      setVisible(false);
      return;
    }

    const view = editor.view;
    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to);

    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    const toolbarWidth = toolbar.offsetWidth || 380;
    const centerX = (start.left + end.right) / 2;
    let left = centerX - toolbarWidth / 2;

    // Keep within viewport
    left = Math.max(8, Math.min(left, window.innerWidth - toolbarWidth - 8));

    setPosition({
      top: start.top - 50,
      left,
    });
    setVisible(true);
  }, [editor]);

  useEffect(() => {
    editor.on("selectionUpdate", updatePosition);
    editor.on("blur", () => {
      // Delay to allow button clicks
      setTimeout(() => {
        if (!toolbarRef.current?.contains(document.activeElement)) {
          setVisible(false);
        }
      }, 150);
    });

    return () => {
      editor.off("selectionUpdate", updatePosition);
    };
  }, [editor, updatePosition]);

  const iconSize = 15;

  const setLink = () => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    const url = window.prompt("输入链接地址：");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  return (
    <div
      ref={toolbarRef}
      className={cn(
        "fixed z-50 flex items-center gap-0.5 rounded-xl border border-stone-800/80 bg-stone-950/95 px-1.5 py-1 shadow-xl backdrop-blur transition-opacity duration-150",
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
      style={{ top: position.top, left: position.left }}
    >
      <BubbleButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="粗体"
      >
        <Bold size={iconSize} className="text-gray-300" />
      </BubbleButton>
      <BubbleButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="斜体"
      >
        <Italic size={iconSize} className="text-gray-300" />
      </BubbleButton>
      <BubbleButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="下划线"
      >
        <UnderlineIcon size={iconSize} className="text-gray-300" />
      </BubbleButton>
      <BubbleButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="删除线"
      >
        <Strikethrough size={iconSize} className="text-gray-300" />
      </BubbleButton>
      <BubbleButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        title="行内代码"
      >
        <Code size={iconSize} className="text-gray-300" />
      </BubbleButton>
      <BubbleButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive("highlight")}
        title="高亮"
      >
        <Highlighter size={iconSize} className="text-gray-300" />
      </BubbleButton>
      <BubbleButton
        onClick={setLink}
        isActive={editor.isActive("link")}
        title={editor.isActive("link") ? "移除链接" : "链接"}
      >
        <LinkIcon size={iconSize} className="text-gray-300" />
      </BubbleButton>
    </div>
  );
}
