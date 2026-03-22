import type { Editor } from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";

export type BlockInsertDirection = "above" | "below";

export interface TopLevelBlockContext {
  index: number;
  pos: number;
  node: ProseMirrorNode;
}

function getTopLevelBlocks(editor: Editor): TopLevelBlockContext[] {
  const blocks: TopLevelBlockContext[] = [];
  let index = 0;

  editor.state.doc.forEach((node, offset) => {
    blocks.push({
      index,
      pos: offset,
      node,
    });
    index += 1;
  });

  return blocks;
}

export function getTopLevelBlockContext(
  editor: Editor,
  position: number
): TopLevelBlockContext | null {
  const blocks = getTopLevelBlocks(editor);

  for (const block of blocks) {
    if (
      position >= block.pos &&
      position < block.pos + block.node.nodeSize
    ) {
      return block;
    }
  }

  return blocks.at(-1) ?? null;
}

function focusAtBlock(editor: Editor, block: TopLevelBlockContext | null) {
  if (!block) return;

  const currentDoc = editor.state.doc;
  const safePos = Math.max(0, Math.min(block.pos, currentDoc.content.size));

  try {
    if (block.node.isLeaf && !block.node.isText) {
      const transaction = editor.state.tr.setSelection(
        NodeSelection.create(currentDoc, safePos)
      );
      editor.view.dispatch(transaction.scrollIntoView());
      editor.view.focus();
      return;
    }

    const textPos = Math.min(safePos + 1, currentDoc.content.size);
    const transaction = editor.state.tr.setSelection(
      TextSelection.near(currentDoc.resolve(textPos))
    );
    editor.view.dispatch(transaction.scrollIntoView());
    editor.view.focus();
  } catch {
    editor.commands.focus();
  }
}

export function focusTopLevelBlock(editor: Editor, position: number) {
  focusAtBlock(editor, getTopLevelBlockContext(editor, position));
}

export function insertParagraphRelativeToBlock(
  editor: Editor,
  position: number,
  direction: BlockInsertDirection
) {
  const block = getTopLevelBlockContext(editor, position);
  const paragraphNodeType = editor.state.schema.nodes.paragraph;

  if (!block || !paragraphNodeType) return null;

  const insertPos =
    direction === "above" ? block.pos : block.pos + block.node.nodeSize;

  let transaction = editor.state.tr.insert(insertPos, paragraphNodeType.create());
  const textPos = Math.min(insertPos + 1, transaction.doc.content.size);
  transaction = transaction.setSelection(
    TextSelection.near(transaction.doc.resolve(textPos))
  );

  editor.view.dispatch(transaction.scrollIntoView());
  editor.view.focus();

  return insertPos;
}

export function insertHorizontalRuleRelativeToBlock(
  editor: Editor,
  position: number,
  direction: BlockInsertDirection
) {
  const block = getTopLevelBlockContext(editor, position);
  const paragraphNodeType = editor.state.schema.nodes.paragraph;
  const horizontalRuleNodeType = editor.state.schema.nodes.horizontalRule;

  if (!block || !paragraphNodeType || !horizontalRuleNodeType) return null;

  const insertPos =
    direction === "above" ? block.pos : block.pos + block.node.nodeSize;

  let transaction = editor.state.tr.insert(
    insertPos,
    horizontalRuleNodeType.create()
  );
  const paragraphPos = insertPos + horizontalRuleNodeType.create().nodeSize;

  transaction = transaction.insert(paragraphPos, paragraphNodeType.create());
  transaction = transaction.setSelection(
    TextSelection.near(transaction.doc.resolve(paragraphPos + 1))
  );

  editor.view.dispatch(transaction.scrollIntoView());
  editor.view.focus();

  return insertPos;
}

function ensureAtLeastOneParagraph(editor: Editor) {
  if (editor.state.doc.childCount > 0) return;

  const paragraphNodeType = editor.state.schema.nodes.paragraph;
  if (!paragraphNodeType) return;

  let transaction = editor.state.tr.insert(0, paragraphNodeType.create());
  transaction = transaction.setSelection(
    TextSelection.near(transaction.doc.resolve(1))
  );
  editor.view.dispatch(transaction.scrollIntoView());
}

export function duplicateTopLevelBlock(editor: Editor, position: number) {
  const block = getTopLevelBlockContext(editor, position);
  if (!block) return;

  const insertPos = block.pos + block.node.nodeSize;
  const clonedNode = block.node.type.create(
    block.node.attrs,
    block.node.content,
    block.node.marks
  );

  const transaction = editor.state.tr.insert(insertPos, clonedNode);
  editor.view.dispatch(transaction.scrollIntoView());
  focusTopLevelBlock(editor, insertPos);
}

export function deleteTopLevelBlock(editor: Editor, position: number) {
  const block = getTopLevelBlockContext(editor, position);
  if (!block) return;

  const nextFocusPos = block.pos;
  const transaction = editor.state.tr.delete(
    block.pos,
    block.pos + block.node.nodeSize
  );

  editor.view.dispatch(transaction.scrollIntoView());
  ensureAtLeastOneParagraph(editor);
  focusTopLevelBlock(editor, Math.min(nextFocusPos, editor.state.doc.content.size));
}

export function moveTopLevelBlock(
  editor: Editor,
  position: number,
  direction: "up" | "down"
) {
  const blocks = getTopLevelBlocks(editor);
  const current = getTopLevelBlockContext(editor, position);

  if (!current) return;

  const targetIndex =
    direction === "up" ? current.index - 1 : current.index + 1;
  const target = blocks[targetIndex];

  if (!target) return;

  const transaction = editor.state.tr.delete(
    current.pos,
    current.pos + current.node.nodeSize
  );

  const insertPos =
    direction === "up"
      ? target.pos
      : target.pos + target.node.nodeSize - current.node.nodeSize;

  transaction.insert(insertPos, current.node);
  editor.view.dispatch(transaction.scrollIntoView());
  focusTopLevelBlock(editor, insertPos);
}
