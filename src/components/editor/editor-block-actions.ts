import type { Editor as TiptapEditorInstance } from "@tiptap/react";
import {
  ArrowDown,
  ArrowUp,
  Columns2,
  Copy,
  Trash2,
} from "lucide-react";
import {
  deleteTopLevelBlock,
  duplicateTopLevelBlock,
  focusTopLevelBlock,
  getTopLevelBlockContext,
  moveTopLevelBlock,
} from "./editor-block-ops";
import {
  flattenEditorCommandGroups,
  type EditorCommandItem,
  type EditorCommandGroup,
} from "./editor-commands";

interface BlockActionMenuState {
  coords: { top: number; left: number };
  targetPos: number;
}

function collectImagesFromNode(node: { type: { name: string }; attrs: Record<string, unknown> }): { src: string; width?: number }[] {
  if (node.type.name === "image") {
    const src = node.attrs.src as string;
    return src ? [{ src }] : [];
  }
  if (node.type.name === "imageRowBlock") {
    try {
      const parsed = JSON.parse(node.attrs.images as string);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  return [];
}

export function buildBlockActionItems(
  editor: TiptapEditorInstance,
  state: BlockActionMenuState,
  commandGroups: EditorCommandGroup[]
): EditorCommandItem[] {
  const block = getTopLevelBlockContext(editor, state.targetPos);
  if (!block) return [];

  const items: EditorCommandItem[] = [];

  if (block.index > 0) {
    items.push({
      id: "move-up",
      title: "上移",
      description: "将当前块向上移动一行",
      keywords: ["move", "up", "上移"],
      icon: ArrowUp,
      run: (ed) => {
        moveTopLevelBlock(ed, state.targetPos, "up");
      },
    });
  }

  if (block.index < editor.state.doc.childCount - 1) {
    items.push({
      id: "move-down",
      title: "下移",
      description: "将当前块向下移动一行",
      keywords: ["move", "down", "下移"],
      icon: ArrowDown,
      run: (ed) => {
        moveTopLevelBlock(ed, state.targetPos, "down");
      },
    });
  }

  // "Merge into row" action for image blocks when an adjacent block is also an image or imageRowBlock
  if (block.node.type.name === "image" || block.node.type.name === "imageRowBlock") {
    const doc = editor.state.doc;
    // Check next sibling
    if (block.index < doc.childCount - 1) {
      const nextPos = state.targetPos + block.node.nodeSize;
      const nextNode = doc.nodeAt(nextPos);
      if (nextNode && (nextNode.type.name === "image" || nextNode.type.name === "imageRowBlock")) {
        items.push({
          id: "merge-with-next",
          title: "与下方图片并排",
          description: "合并为并排图片行",
          keywords: ["merge", "row", "并排"],
          icon: Columns2,
          run: (ed) => {
            const curBlock = getTopLevelBlockContext(ed, state.targetPos);
            if (!curBlock) return;
            const curNode = curBlock.node;
            const curEnd = state.targetPos + curNode.nodeSize;
            const nNode = ed.state.doc.nodeAt(curEnd);
            if (!nNode) return;

            const imgs = [
              ...collectImagesFromNode(curNode),
              ...collectImagesFromNode(nNode),
            ];

            const rowType = ed.state.schema.nodes.imageRowBlock;
            if (!rowType || imgs.length === 0) return;
            const newNode = rowType.create({ images: JSON.stringify(imgs) });
            const { tr } = ed.state;
            tr.replaceWith(state.targetPos, curEnd + nNode.nodeSize, newNode);
            ed.view.dispatch(tr);
          },
        });
      }
    }
    // Check previous sibling
    if (block.index > 0) {
      let prevNode = null as typeof block.node | null;
      let idx = 0;
      doc.forEach((node) => {
        if (idx === block.index - 1) {
          prevNode = node;
        }
        idx++;
      });
      if (prevNode && (prevNode.type.name === "image" || prevNode.type.name === "imageRowBlock")) {
        items.push({
          id: "merge-with-prev",
          title: "与上方图片并排",
          description: "合并为并排图片行",
          keywords: ["merge", "row", "并排"],
          icon: Columns2,
          run: (ed) => {
            // Re-find prev block at run time
            const curBlock2 = getTopLevelBlockContext(ed, state.targetPos);
            if (!curBlock2 || curBlock2.index === 0) return;
            let pPos = 0;
            let pNode = null as typeof block.node | null;
            let i2 = 0;
            ed.state.doc.forEach((node, offset) => {
              if (i2 === curBlock2.index - 1) {
                pPos = offset;
                pNode = node;
              }
              i2++;
            });
            if (!pNode) return;

            const imgs = [
              ...collectImagesFromNode(pNode),
              ...collectImagesFromNode(curBlock2.node),
            ];

            const rowType = ed.state.schema.nodes.imageRowBlock;
            if (!rowType || imgs.length === 0) return;
            const newNode = rowType.create({ images: JSON.stringify(imgs) });
            const { tr } = ed.state;
            tr.replaceWith(pPos, state.targetPos + curBlock2.node.nodeSize, newNode);
            ed.view.dispatch(tr);
          },
        });
      }
    }
  }

  items.push(
    {
      id: "duplicate-block",
      title: "复制块",
      description: "复制当前块内容",
      keywords: ["duplicate", "copy", "复制"],
      icon: Copy,
      run: (ed) => {
        duplicateTopLevelBlock(ed, state.targetPos);
      },
    },
    {
      id: "delete-block",
      title: "删除块",
      description: "删除当前块",
      keywords: ["delete", "remove", "删除"],
      icon: Trash2,
      run: (ed) => {
        deleteTopLevelBlock(ed, state.targetPos);
      },
      tone: "danger",
    }
  );

  const transformable = ![
    "image",
    "horizontalRule",
    "calloutBlock",
    "toggleBlock",
    "excalidrawBlock",
    "imageRowBlock",
    "mermaidBlock",
    "tocBlock",
  ].includes(block.node.type.name);

  if (transformable) {
    const transformItems = flattenEditorCommandGroups(
      commandGroups.filter((group) => group.id !== "media")
    )
      .filter(
        (item) => item.id !== "horizontal-rule" && item.transformable !== false
      )
      .map((item) => ({
        ...item,
        id: `transform-${item.id}`,
        title: `转为${item.title}`,
        description: `将当前块转换为${item.title}`,
        run: (ed: TiptapEditorInstance) => {
          focusTopLevelBlock(ed, state.targetPos);
          item.run(ed);
        },
      }));

    items.push(...transformItems);
  }

  return items;
}
