"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
} from "react";
import { Editor, Extension } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import {
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code2,
  Minus,
  Type,
  type LucideIcon,
} from "lucide-react";

interface CommandItem {
  title: string;
  description: string;
  icon: LucideIcon;
  command: (editor: Editor) => void;
}

const COMMANDS: CommandItem[] = [
  {
    title: "正文",
    description: "普通段落文本",
    icon: Type,
    command: (editor) =>
      editor.chain().focus().setParagraph().run(),
  },
  {
    title: "标题 1",
    description: "大标题",
    icon: Heading1,
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: "标题 2",
    description: "中标题",
    icon: Heading2,
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: "标题 3",
    description: "小标题",
    icon: Heading3,
    command: (editor) =>
      editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: "无序列表",
    description: "用圆点列出项目",
    icon: List,
    command: (editor) =>
      editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: "有序列表",
    description: "用数字列出项目",
    icon: ListOrdered,
    command: (editor) =>
      editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: "待办列表",
    description: "用复选框追踪任务",
    icon: CheckSquare,
    command: (editor) =>
      editor.chain().focus().toggleTaskList().run(),
  },
  {
    title: "引用",
    description: "引用块",
    icon: Quote,
    command: (editor) =>
      editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: "代码块",
    description: "带语法高亮的代码",
    icon: Code2,
    command: (editor) =>
      editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: "分割线",
    description: "水平分隔线",
    icon: Minus,
    command: (editor) =>
      editor.chain().focus().setHorizontalRule().run(),
  },
];

/**
 * Tiptap extension that listens for '/' at the start of a line
 * and communicates with the React slash-command menu via a callback.
 */
export function createSlashCommandExtension(
  onActivate: (query: string, coords: { top: number; left: number }) => void,
  onDeactivate: () => void,
  onQueryChange: (query: string) => void
) {
  let isActive = false;
  let queryStart = 0;

  return Extension.create({
    name: "slashCommand",

    addKeyboardShortcuts() {
      return {
        Escape: () => {
          if (isActive) {
            isActive = false;
            onDeactivate();
            return true;
          }
          return false;
        },
      };
    },

    onUpdate({ editor }) {
      if (!isActive) return;
      const { state } = editor;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(queryStart, from, "\n", " ");
      if (!textBefore.startsWith("/")) {
        isActive = false;
        onDeactivate();
        return;
      }
      onQueryChange(textBefore.slice(1));
    },

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey("slashCommand"),
          props: {
            handleKeyDown(view: EditorView, event: KeyboardEvent) {
              if (event.key === "/" && !isActive) {
                const { state } = view;
                const { $from } = state.selection;
                // Only trigger at start of empty block or end of text
                const textBefore = $from.parent.textContent.slice(
                  0,
                  $from.parentOffset
                );
                if (textBefore.trim() === "") {
                  // Get cursor coordinates
                  const coords = view.coordsAtPos($from.pos);
                  isActive = true;
                  queryStart = $from.pos;
                  setTimeout(() => {
                    onActivate("", {
                      top: coords.bottom + 4,
                      left: coords.left,
                    });
                  }, 0);
                }
              }
              return false;
            },
          },
        }),
      ];
    },

    onSelectionUpdate({ editor }) {
      if (!isActive) return;
      const { from } = editor.state.selection;
      if (from < queryStart) {
        isActive = false;
        onDeactivate();
      }
    },
  });
}

interface SlashCommandMenuProps {
  editor: Editor;
  coords: { top: number; left: number } | null;
  query: string;
  onClose: () => void;
}

export function SlashCommandMenu({
  editor,
  coords,
  query,
  onClose,
}: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const filtered = COMMANDS.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description.toLowerCase().includes(query.toLowerCase())
  );

  // selectedIndex is derived: reset to 0 when query changes via key prop on wrapper
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Adjust menu position to stay in viewport
  useLayoutEffect(() => {
    if (!menuRef.current || !coords) return;
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportH = window.innerHeight;
    if (rect.bottom > viewportH - 20) {
      menu.style.top = `${coords.top - rect.height - 8}px`;
    }
  }, [coords, filtered.length]);

  const executeCommand = useCallback(
    (cmd: CommandItem) => {
      const { state } = editor;
      const { from } = state.selection;
      const text = state.doc.textBetween(
        Math.max(0, from - query.length - 1),
        from
      );
      const slashIndex = text.lastIndexOf("/");
      if (slashIndex >= 0) {
        const deleteFrom = from - query.length - 1;
        editor
          .chain()
          .focus()
          .deleteRange({ from: deleteFrom, to: from })
          .run();
      }
      cmd.command(editor);
      onClose();
    },
    [editor, query, onClose]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          (prev - 1 + filtered.length) % filtered.length
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          executeCommand(filtered[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filtered, selectedIndex, executeCommand]);

  if (!coords || filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-72 max-h-80 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 py-1"
      style={{ top: coords.top, left: coords.left }}
    >
      {filtered.map((cmd, i) => {
        const Icon = cmd.icon;
        return (
          <button
            key={cmd.title}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 transition-colors ${
              i === selectedIndex ? "bg-gray-100" : ""
            }`}
            onClick={() => executeCommand(cmd)}
            onMouseEnter={() => setSelectedIndex(i)}
          >
            <div className="flex items-center justify-center w-10 h-10 rounded-md border border-gray-200 bg-white shrink-0">
              <Icon size={18} className="text-gray-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">
                {cmd.title}
              </div>
              <div className="text-xs text-gray-500">{cmd.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
