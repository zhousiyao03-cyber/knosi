/**
 * Extracts wiki-link references from Tiptap JSON content.
 *
 * Walks the document tree looking for marks of type "wikiLink",
 * collecting { noteId, noteTitle } pairs.
 */

interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TiptapNode {
  type?: string;
  text?: string;
  marks?: TiptapMark[];
  content?: TiptapNode[];
}

export interface ExtractedLink {
  noteId: string;
  noteTitle: string;
}

export function extractWikiLinks(contentJson: string | null): ExtractedLink[] {
  if (!contentJson) return [];

  let doc: TiptapNode;
  try {
    doc = JSON.parse(contentJson) as TiptapNode;
  } catch {
    return [];
  }

  const links = new Map<string, string>(); // noteId → noteTitle (dedup)

  function walk(node: TiptapNode) {
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === "wikiLink" && mark.attrs) {
          const noteId = mark.attrs.noteId as string | undefined;
          const noteTitle = mark.attrs.noteTitle as string | undefined;
          if (noteId && noteTitle) {
            links.set(noteId, noteTitle);
          }
        }
      }
    }
    if (node.content) {
      for (const child of node.content) {
        walk(child);
      }
    }
  }

  walk(doc);

  return Array.from(links.entries()).map(([noteId, noteTitle]) => ({
    noteId,
    noteTitle,
  }));
}
