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

export async function uploadImageFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload/image", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("请先登录后再上传图片。");
    if (response.status === 413) throw new Error("单张图片不能超过 5MB。");
    if (response.status === 415)
      throw new Error("当前只支持 PNG、JPG、WEBP 和 GIF 图片。");
    throw new Error("图片上传失败，请重试。");
  }

  const data = (await response.json()) as { url?: string };
  if (!data.url) throw new Error("图片上传失败，请重试。");
  return data.url;
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
