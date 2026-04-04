import type { EditorView } from "@tiptap/pm/view";
import type { JSONContent } from "@tiptap/react";

export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export function parseEditorContent(content?: string): JSONContent | undefined {
  if (!content) return undefined;

  try {
    return JSON.parse(content) as JSONContent;
  } catch {
    return undefined;
  }
}

export function extractPlainTextFromContent(content?: JSONContent) {
  if (!content) return "";

  const lines: string[] = [];

  const collectInlineText = (node: JSONContent): string => {
    if (node.type === "text") {
      return node.text ?? "";
    }

    if (node.type === "hardBreak") {
      return "\n";
    }

    return (node.content ?? []).map(collectInlineText).join("");
  };

  const visitBlock = (node: JSONContent) => {
    if (node.type === "toggleBlock") {
      const summary = String(node.attrs?.summary ?? "").trim();
      if (summary) lines.push(summary);
      for (const child of node.content ?? []) {
        visitBlock(child);
      }
      return;
    }

    if (
      node.type === "doc" ||
      node.type === "bulletList" ||
      node.type === "orderedList" ||
      node.type === "taskList" ||
      node.type === "listItem" ||
      node.type === "calloutBlock"
    ) {
      for (const child of node.content ?? []) {
        visitBlock(child);
      }
      return;
    }

    if (node.type === "mermaidBlock") {
      const code = String(node.attrs?.code ?? "").trim();
      if (code) lines.push(code);
      return;
    }

    if (node.type === "horizontalRule") {
      lines.push("---");
      return;
    }

    const text = collectInlineText(node).trim();
    if (text) {
      lines.push(text);
    }
  };

  visitBlock(content);

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function validateImageFile(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return "当前只支持 PNG、JPG、WEBP 和 GIF 图片。";
  }

  if (file.size > MAX_IMAGE_FILE_SIZE) {
    return "单张图片不能超过 5MB。";
  }

  return null;
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("图片读取失败"));
    };

    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

export function insertImagesIntoView(
  view: EditorView,
  sources: string[],
  position?: number
) {
  const imageNodeType = view.state.schema.nodes.image;
  const paragraphNodeType = view.state.schema.nodes.paragraph;

  if (!imageNodeType) return;

  let transaction = view.state.tr;
  let insertPosition = position ?? transaction.selection.from;

  for (const source of sources) {
    const imageNode = imageNodeType.create({
      src: source,
      alt: "插入图片",
    });

    transaction = transaction.insert(insertPosition, imageNode);
    insertPosition += imageNode.nodeSize;

    if (paragraphNodeType) {
      const paragraphNode = paragraphNodeType.create();
      transaction = transaction.insert(insertPosition, paragraphNode);
      insertPosition += paragraphNode.nodeSize;
    }
  }

  view.dispatch(transaction.scrollIntoView());
  view.focus();
}
