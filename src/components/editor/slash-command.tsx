"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useLayoutEffect,
} from "react";
import { Extension, type Editor } from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorCommandItem } from "./editor-commands";

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
                const textBefore = $from.parent.textContent.slice(
                  0,
                  $from.parentOffset
                );

                if (textBefore.trim() === "") {
                  const coords = view.coordsAtPos($from.pos);
                  isActive = true;
                  queryStart = $from.pos;

                  setTimeout(() => {
                    onActivate("", {
                      top: coords.bottom + 8,
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
  items: EditorCommandItem[];
  deleteTrigger?: boolean;
  onClose: () => void;
}

export function SlashCommandMenu({
  editor,
  coords,
  query,
  items,
  deleteTrigger = true,
  onClose,
}: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (!normalizedQuery) return true;

    return [
      item.title,
      item.description,
      ...item.keywords,
    ].some((value) => value.toLowerCase().includes(normalizedQuery));
  });

  useLayoutEffect(() => {
    if (!menuRef.current || !coords) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    menu.style.top = `${coords.top}px`;
    menu.style.left = `${Math.min(coords.left, viewportWidth - rect.width - 20)}px`;

    if (rect.bottom > viewportHeight - 20) {
      menu.style.top = `${coords.top - rect.height - 12}px`;
    }
  }, [coords, filtered.length]);

  const executeCommand = useCallback(
    (item: EditorCommandItem) => {
      if (deleteTrigger) {
        const { from } = editor.state.selection;
        const deleteFrom = Math.max(0, from - query.length - 1);

        editor
          .chain()
          .focus()
          .deleteRange({ from: deleteFrom, to: from })
          .run();
      }

      item.run(editor);
      onClose();
    },
    [deleteTrigger, editor, onClose, query]
  );

  useEffect(() => {
    if (!filtered.length) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((previous) => (previous + 1) % filtered.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex(
          (previous) => (previous - 1 + filtered.length) % filtered.length
        );
      } else if (event.key === "Enter") {
        event.preventDefault();

        const selectedItem = filtered[selectedIndex];
        if (selectedItem) {
          executeCommand(selectedItem);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [executeCommand, filtered, selectedIndex]);

  if (!coords || filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-80 max-h-96 overflow-y-auto rounded-2xl border border-stone-200 bg-white p-1 shadow-2xl dark:border-stone-800 dark:bg-stone-950"
      style={{ top: coords.top, left: coords.left }}
    >
      {filtered.map((item, index) => {
        const Icon = item.icon;
        const isActive = item.isActive?.(editor) ?? false;

        return (
          <button
            key={item.id}
            type="button"
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
              index === selectedIndex
                ? "bg-stone-100 dark:bg-stone-900"
                : "hover:bg-stone-50 dark:hover:bg-stone-900/70"
            }`}
            onClick={() => executeCommand(item)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                isActive
                  ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-950"
                  : "border-stone-200 bg-white text-stone-500 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-300"
              }`}
            >
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-stone-900 dark:text-stone-100">
                {item.title}
              </div>
              <div className="text-xs text-stone-500 dark:text-stone-400">
                {item.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
