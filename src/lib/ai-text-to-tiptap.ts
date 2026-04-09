import type { JSONContent } from "@tiptap/react";

/**
 * Convert AI plain-text output into a Tiptap JSON content array, ready for
 * `editor.chain().insertContentAt(pos, nodes).run()`.
 *
 * Supports the minimal Markdown the AI usually emits:
 *  - `# ` through `###### ` headings
 *  - `- ` bullet list items (contiguous lines merged into one bulletList)
 *  - ```` ``` ```` fenced code blocks (optional language tag)
 *  - blank-line separated paragraphs
 *
 * Anything unrecognized falls back to a plain paragraph. Empty / whitespace
 * input returns an empty array so callers can short-circuit the insert.
 */
export function aiTextToTiptapJson(input: string): JSONContent[] {
  const text = input ?? "";
  if (!text.trim()) return [];

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: JSONContent[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim() || null;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip closing fence (if present)
      out.push({
        type: "codeBlock",
        attrs: lang ? { language: lang } : {},
        content: buf.length > 0 ? [{ type: "text", text: buf.join("\n") }] : [],
      });
      continue;
    }

    // Heading
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      out.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: [{ type: "text", text: headingMatch[2] }],
      });
      i++;
      continue;
    }

    // Bullet list (contiguous `- ` lines)
    if (/^-\s+/.test(line)) {
      const items: JSONContent[] = [];
      while (i < lines.length && /^-\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^-\s+/, "");
        items.push({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: itemText }],
            },
          ],
        });
        i++;
      }
      out.push({ type: "bulletList", content: items });
      continue;
    }

    // Blank line → skip (paragraphs are implicit from non-blank lines)
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph
    out.push({
      type: "paragraph",
      content: [{ type: "text", text: line }],
    });
    i++;
  }

  return out;
}
