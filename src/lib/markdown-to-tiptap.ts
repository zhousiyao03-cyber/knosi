type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

/** Parse inline markdown (bold, italic, code, links) into Tiptap inline nodes */
function parseInlineMarkdown(text: string): TiptapNode[] {
  const nodes: TiptapNode[] = [];
  // Match: **bold**, *italic*, `code`, [text](url)
  const inlineRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[2]) {
      nodes.push({ type: "text", text: match[2], marks: [{ type: "bold" }] });
    } else if (match[3]) {
      nodes.push({ type: "text", text: match[3], marks: [{ type: "italic" }] });
    } else if (match[4]) {
      nodes.push({ type: "text", text: match[4], marks: [{ type: "code" }] });
    } else if (match[5] && match[6]) {
      nodes.push({
        type: "text",
        text: match[5],
        marks: [{ type: "link", attrs: { href: match[6] } }],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIndex) });
  }

  return nodes.length > 0 ? nodes : [{ type: "text", text }];
}

/** Convert markdown string to Tiptap-compatible JSON document */
export function markdownToTiptap(markdown: string): TiptapNode {
  const lines = markdown.split("\n");
  const content: TiptapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.trim() === "") {
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      content.push({
        type: "heading",
        attrs: { level: headingMatch[1]!.length },
        content: parseInlineMarkdown(headingMatch[2]!),
      });
      i++;
      continue;
    }

    // Code blocks
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || null;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("```")) {
        codeLines.push(lines[i]!);
        i++;
      }
      i++;
      content.push({
        type: "codeBlock",
        attrs: { language: lang },
        content: [{ type: "text", text: codeLines.join("\n") }],
      });
      continue;
    }

    // Unordered list items
    if (/^[-*]\s+/.test(line)) {
      const items: TiptapNode[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i]!)) {
        const itemText = lines[i]!.replace(/^[-*]\s+/, "");
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInlineMarkdown(itemText) }],
        });
        i++;
      }
      content.push({ type: "bulletList", content: items });
      continue;
    }

    // Ordered list items
    if (/^\d+\.\s+/.test(line)) {
      const items: TiptapNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!)) {
        const itemText = lines[i]!.replace(/^\d+\.\s+/, "");
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInlineMarkdown(itemText) }],
        });
        i++;
      }
      content.push({ type: "orderedList", content: items });
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("> ")) {
        quoteLines.push(lines[i]!.slice(2));
        i++;
      }
      content.push({
        type: "blockquote",
        content: [
          { type: "paragraph", content: parseInlineMarkdown(quoteLines.join(" ")) },
        ],
      });
      continue;
    }

    // Markdown table
    if (line.includes("|") && i + 1 < lines.length && /^\|?\s*[-:]+[-|\s:]*$/.test(lines[i + 1]!.trim())) {
      const parseLine = (l: string): string[] =>
        l.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const headers = parseLine(line);
      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i]!.includes("|") && lines[i]!.trim() !== "") {
        bodyRows.push(parseLine(lines[i]!));
        i++;
      }
      const headerRow: TiptapNode = {
        type: "tableRow",
        content: headers.map((cell) => ({
          type: "tableHeader",
          content: [{ type: "paragraph", content: cell ? parseInlineMarkdown(cell) : [] }],
        })),
      };
      const dataRows: TiptapNode[] = bodyRows.map((row) => ({
        type: "tableRow",
        content: headers.map((_, idx) => ({
          type: "tableCell",
          content: [{ type: "paragraph", content: row[idx] ? parseInlineMarkdown(row[idx]!) : [] }],
        })),
      }));
      content.push({ type: "table", content: [headerRow, ...dataRows] });
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      content.push({ type: "horizontalRule" });
      i++;
      continue;
    }

    // Regular paragraph
    content.push({
      type: "paragraph",
      content: parseInlineMarkdown(line),
    });
    i++;
  }

  return { type: "doc", content };
}
