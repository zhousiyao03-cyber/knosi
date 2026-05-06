"use client";

import {
  Node,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import { useEffect, useRef, useState, useCallback } from "react";

interface TocEntry {
  level: number;
  text: string;
  pos: number;
}

/**
 * Scan the editor document for heading nodes (levels 1, 2, 3)
 * and return an array of TOC entries with their position info.
 */
function scanHeadings(editor: Editor): TocEntry[] {
  const entries: TocEntry[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      entries.push({
        level: node.attrs.level as number,
        text: node.textContent,
        pos,
      });
    }
  });
  return entries;
}

/** Indentation class based on heading level. */
function indentClass(level: number): string {
  if (level === 2) return "pl-4";
  if (level === 3) return "pl-8";
  if (level === 4) return "pl-12";
  if (level === 5) return "pl-16";
  if (level >= 6) return "pl-20";
  return "";
}

function TocNodeView({ editor }: NodeViewProps) {
  const [entries, setEntries] = useState<TocEntry[]>(() => scanHeadings(editor));

  // Coalesce rescans behind a quiet-window timer (long docs would otherwise
  // run a full doc descendants() walk + setState on every keystroke). Bail
  // out via structural equality so React skips reconciliation when nothing
  // material changed.
  const rescanTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const scheduleRescan = useCallback(() => {
    if (rescanTimerRef.current) return;
    rescanTimerRef.current = setTimeout(() => {
      rescanTimerRef.current = undefined;
      setEntries((prev) => {
        const next = scanHeadings(editor);
        if (
          prev.length === next.length &&
          prev.every(
            (h, i) =>
              h.pos === next[i].pos &&
              h.level === next[i].level &&
              h.text === next[i].text
          )
        ) {
          return prev;
        }
        return next;
      });
    }, 300);
  }, [editor]);

  useEffect(() => {
    editor.on("update", scheduleRescan);
    return () => {
      editor.off("update", scheduleRescan);
      if (rescanTimerRef.current) {
        clearTimeout(rescanTimerRef.current);
        rescanTimerRef.current = undefined;
      }
    };
  }, [editor, scheduleRescan]);

  const handleClick = useCallback(
    (pos: number) => {
      editor.chain().focus().setTextSelection(pos + 1).scrollIntoView().run();
    },
    [editor]
  );

  return (
    <NodeViewWrapper data-toc-block="true" contentEditable={false}>
      <div className="notion-toc">
        <div className="notion-toc-title">Table of Contents</div>

        {entries.length === 0 ? (
          <p className="notion-toc-item" style={{ cursor: "default" }}>
            No headings
          </p>
        ) : (
          entries.map((entry) => (
            <button
              key={`${entry.pos}-${entry.text}`}
              type="button"
              className={`notion-toc-item ${indentClass(entry.level)}`}
              onClick={() => handleClick(entry.pos)}
            >
              {entry.text || "(empty heading)"}
            </button>
          ))
        )}
      </div>
    </NodeViewWrapper>
  );
}

/**
 * Tiptap extension: Table of Contents block.
 *
 * An atom block that automatically scans all H1/H2/H3 headings in the
 * document and renders a clickable, indented outline.
 */
export const TocBlock = Node.create({
  name: "tocBlock",
  group: "block",
  atom: true,

  parseHTML() {
    return [{ tag: 'div[data-toc-block="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { ...HTMLAttributes, "data-toc-block": "true" }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TocNodeView);
  },
});
