import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/** Mermaid diagram type keywords that appear at the start of a definition. */
const MERMAID_KEYWORDS = [
  "graph ",
  "graph\n",
  "flowchart ",
  "flowchart\n",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram",
  "erDiagram",
  "gantt",
  "pie ",
  "pie\n",
  "gitGraph",
  "journey",
  "mindmap",
  "timeline",
  "quadrantChart",
  "xychart",
  "block-beta",
  "sankey-beta",
];

/**
 * Detect if text looks like a Mermaid diagram definition.
 */
function isMermaidCode(text: string): boolean {
  const trimmed = text.trim();
  return MERMAID_KEYWORDS.some((kw) => trimmed.startsWith(kw));
}

/**
 * Detect if text looks like a markdown table.
 * Requires at least a header row and a separator row (|---|).
 */
function isMarkdownTable(text: string): boolean {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return false;

  // Check that lines contain pipes
  const hasPipes = lines[0].includes("|") && lines[1].includes("|");
  if (!hasPipes) return false;

  // The second line should be a separator row like |---|---|
  const separatorRegex = /^\|?\s*[-:]+[-|\s:]*$/;
  return separatorRegex.test(lines[1].trim());
}

/**
 * Parse a markdown table string into a 2D array of cells.
 * Returns { headers: string[], rows: string[][] }
 */
function parseMarkdownTable(text: string): {
  headers: string[];
  rows: string[][];
} {
  const lines = text
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const parseLine = (line: string): string[] =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());

  const headers = parseLine(lines[0]);
  // Skip the separator line (index 1)
  const rows = lines.slice(2).map(parseLine);

  return { headers, rows };
}

/**
 * Convert parsed markdown table into Tiptap JSON content for insertion.
 */
function markdownTableToTiptapJson(text: string) {
  const { headers, rows } = parseMarkdownTable(text);

  const headerRow = {
    type: "tableRow",
    content: headers.map((cell) => ({
      type: "tableHeader",
      content: [{ type: "paragraph", content: cell ? [{ type: "text", text: cell }] : [] }],
    })),
  };

  const bodyRows = rows.map((row) => ({
    type: "tableRow",
    content: headers.map((_, i) => ({
      type: "tableCell",
      content: [
        {
          type: "paragraph",
          content: row[i] ? [{ type: "text", text: row[i] }] : [],
        },
      ],
    })),
  }));

  return {
    type: "table",
    content: [headerRow, ...bodyRows],
  };
}

/**
 * Tiptap extension that intercepts paste events containing markdown tables
 * or Mermaid diagram code and converts them into proper Tiptap nodes.
 */
export const MarkdownTablePaste = Extension.create({
  name: "markdownTablePaste",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("markdownTablePaste"),
        props: {
          handlePaste: (view, event) => {
            const text = event.clipboardData?.getData("text/plain");
            if (!text) return false;

            // Mermaid diagram detection
            if (isMermaidCode(text)) {
              const mermaidJson = {
                type: "mermaidBlock",
                attrs: { code: text.trim() },
              };
              const { state, dispatch } = view;
              const node = state.schema.nodeFromJSON(mermaidJson);
              const tr = state.tr.replaceSelectionWith(node);
              dispatch(tr);
              return true;
            }

            // Markdown table detection
            if (!isMarkdownTable(text)) return false;

            // Don't intercept if there's also HTML content (e.g. from a spreadsheet)
            const html = event.clipboardData?.getData("text/html");
            if (html && html.includes("<table")) return false;

            const tableJson = markdownTableToTiptapJson(text);
            const { state, dispatch } = view;
            const node = state.schema.nodeFromJSON(tableJson);
            const tr = state.tr.replaceSelectionWith(node);
            dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});
