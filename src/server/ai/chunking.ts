import crypto from "node:crypto";

export type KnowledgeSourceType = "note" | "bookmark";

export interface PreparedChunk {
  blockType: string;
  chunkIndex: number;
  sectionPath: string[];
  text: string;
  textHash: string;
  tokenCount: number;
}

interface ChunkInput {
  content?: string | null;
  plainText?: string | null;
  sourceType: KnowledgeSourceType;
  summary?: string | null;
}

const MAX_CHUNK_CHARS = 520;
const MIN_CHUNK_CHARS = 120;

type TiptapNode = {
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  type?: string;
};

function hashText(text: string) {
  return crypto.createHash("sha1").update(text).digest("hex");
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function normalizeChunkText(text: string) {
  return text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();
}

function trimHeadingPath(path: string[], level: number) {
  const trimmed = path.slice(0, Math.max(0, level - 1));
  return trimmed;
}

function getNodeText(node: TiptapNode | null | undefined): string {
  if (!node) return "";

  if (node.type === "text") {
    return node.text ?? "";
  }

  if (node.type === "hardBreak") {
    return "\n";
  }

  const children = (node.content ?? []).map((child) => getNodeText(child));

  if (node.type === "listItem") {
    return children.join("").trim();
  }

  if (
    node.type === "bulletList" ||
    node.type === "orderedList" ||
    node.type === "taskList"
  ) {
    return children
      .map((child) => child.trim())
      .filter(Boolean)
      .map((child) => `- ${child}`)
      .join("\n");
  }

  return children.join("");
}

function pushChunk(
  chunks: PreparedChunk[],
  blockType: string,
  sectionPath: string[],
  parts: string[]
) {
  const text = normalizeChunkText(parts.join("\n\n"));
  if (!text) return;

  chunks.push({
    blockType,
    chunkIndex: chunks.length,
    sectionPath: [...sectionPath],
    text,
    textHash: hashText(text),
    tokenCount: estimateTokens(text),
  });
}

function chunkParagraphs(
  paragraphs: string[],
  sectionPath: string[],
  blockType: string
) {
  const chunks: PreparedChunk[] = [];
  let current: string[] = [];
  let currentSize = 0;

  for (const paragraph of paragraphs.map(normalizeChunkText).filter(Boolean)) {
    const nextSize = currentSize + paragraph.length;
    const shouldFlush =
      current.length > 0 &&
      nextSize > MAX_CHUNK_CHARS &&
      currentSize >= MIN_CHUNK_CHARS;

    if (shouldFlush) {
      pushChunk(chunks, blockType, sectionPath, current);
      current = [];
      currentSize = 0;
    }

    current.push(paragraph);
    currentSize += paragraph.length;
  }

  if (current.length > 0) {
    pushChunk(chunks, blockType, sectionPath, current);
  }

  return chunks;
}

function fallbackChunkText(
  text: string,
  sourceType: KnowledgeSourceType,
  summary?: string | null
) {
  const rawParagraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const paragraphs =
    rawParagraphs.length > 0
      ? rawParagraphs
      : (summary ?? text)
          .split(/(?<=[。！？.!?])\s+/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean);

  return chunkParagraphs(
    paragraphs,
    [],
    sourceType === "bookmark" ? "bookmark" : "paragraph"
  );
}

function chunkNoteContent(content: string, plainText?: string | null) {
  let parsed: TiptapNode | null = null;

  try {
    parsed = JSON.parse(content) as TiptapNode;
  } catch {
    parsed = null;
  }

  if (!parsed?.content?.length) {
    return fallbackChunkText(plainText ?? content, "note");
  }

  const chunks: PreparedChunk[] = [];
  const sectionPath: string[] = [];
  let current: string[] = [];
  let currentSize = 0;
  let currentBlockType = "paragraph";

  const flushCurrent = () => {
    if (current.length === 0) return;
    pushChunk(chunks, currentBlockType, sectionPath, current);
    current = [];
    currentSize = 0;
  };

  for (const node of parsed.content) {
    const nodeType = node.type ?? "paragraph";

    if (nodeType === "heading") {
      flushCurrent();
      const level = Number(node.attrs?.level ?? 1);
      const headingText = normalizeChunkText(getNodeText(node));

      if (headingText) {
        const trimmedPath = trimHeadingPath(sectionPath, level);
        trimmedPath[level - 1] = headingText;
        sectionPath.splice(0, sectionPath.length, ...trimmedPath);
      }

      continue;
    }

    const text = normalizeChunkText(getNodeText(node));
    if (!text) continue;

    if (nodeType === "codeBlock" || nodeType === "blockquote") {
      flushCurrent();
      chunks.push({
        blockType: nodeType,
        chunkIndex: chunks.length,
        sectionPath: [...sectionPath],
        text,
        textHash: hashText(text),
        tokenCount: estimateTokens(text),
      });
      continue;
    }

    if (current.length > 0 && currentSize + text.length > MAX_CHUNK_CHARS) {
      flushCurrent();
    }

    currentBlockType =
      nodeType === "bulletList" ||
      nodeType === "orderedList" ||
      nodeType === "taskList"
        ? "list"
        : "paragraph";
    current.push(text);
    currentSize += text.length;
  }

  flushCurrent();

  if (chunks.length === 0) {
    return fallbackChunkText(plainText ?? "", "note");
  }

  return chunks.map((chunk, index) => ({ ...chunk, chunkIndex: index }));
}

function chunkBookmarkContent(text: string, summary?: string | null) {
  return fallbackChunkText(text, "bookmark", summary);
}

export function chunkKnowledgeSource(input: ChunkInput) {
  if (input.sourceType === "note") {
    return chunkNoteContent(input.content ?? "", input.plainText);
  }

  const baseText = normalizeChunkText(input.content ?? input.summary ?? "");
  return chunkBookmarkContent(baseText, input.summary);
}
