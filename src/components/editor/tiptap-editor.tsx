"use client";

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  type ChangeEvent,
  type MouseEvent,
} from "react";
import {
  EditorContent,
  useEditor,
  type JSONContent,
  type Editor as TiptapEditorInstance,
} from "@tiptap/react";
import type { EditorView } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Typography from "@tiptap/extension-typography";
import { common, createLowlight } from "lowlight";
import { GripVertical, Plus } from "lucide-react";
import {
  createSlashCommandExtension,
  SlashCommandMenu,
} from "./slash-command";
import { BubbleToolbar } from "./bubble-toolbar";
import {
  createEditorCommandGroups,
  flattenEditorCommandGroups,
} from "./editor-commands";

const lowlight = createLowlight(common);

const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

interface TiptapEditorProps {
  content?: string;
  onChange?: (content: string, plainText: string) => void;
  onError?: (message: string) => void;
  editable?: boolean;
  placeholder?: string;
}

interface HoveredBlock {
  pos: number;
  buttonTop: number;
  menuTop: number;
  menuLeft: number;
  top: number;
  bottom: number;
  contentLeft: number;
}

function parseEditorContent(content?: string): JSONContent | undefined {
  if (!content) return undefined;

  try {
    return JSON.parse(content) as JSONContent;
  } catch {
    return undefined;
  }
}

function validateImageFile(file: File) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return "当前只支持 PNG、JPG、WEBP 和 GIF 图片。";
  }

  if (file.size > MAX_IMAGE_FILE_SIZE) {
    return "单张图片不能超过 5MB。";
  }

  return null;
}

function readFileAsDataUrl(file: File) {
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

function insertImagesIntoView(
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

export function TiptapEditor({
  content,
  onChange,
  onError,
  editable = true,
  placeholder = "输入 / 以插入命令...",
}: TiptapEditorProps) {
  const [slashCoords, setSlashCoords] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [slashQuery, setSlashQuery] = useState("");
  const [hoveredBlock, setHoveredBlock] = useState<HoveredBlock | null>(null);
  const [blockMenuCoords, setBlockMenuCoords] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<TiptapEditorInstance | null>(null);
  const editorSurfaceRef = useRef<HTMLDivElement>(null);
  const hoveredBlockRef = useRef<HoveredBlock | null>(null);

  const handleSlashActivate = useCallback(
    (query: string, coords: { top: number; left: number }) => {
      setBlockMenuCoords(null);
      setSlashQuery(query);
      setSlashCoords(coords);
    },
    []
  );

  const handleSlashDeactivate = useCallback(() => {
    setSlashCoords(null);
    setSlashQuery("");
  }, []);

  const handleSlashQueryChange = useCallback((query: string) => {
    setSlashQuery(query);
  }, []);

  const slashCommandExtension = useMemo(
    () =>
      createSlashCommandExtension(
        handleSlashActivate,
        handleSlashDeactivate,
        handleSlashQueryChange
      ),
    [handleSlashActivate, handleSlashDeactivate, handleSlashQueryChange]
  );

  const reportError = useCallback(
    (message: string) => {
      onError?.(message);
    },
    [onError]
  );

  const insertImageFromUrl = useCallback(() => {
    const url = window.prompt("输入图片地址：")?.trim();

    if (!url) return;

    if (!/^https?:\/\//.test(url) && !url.startsWith("data:image/")) {
      reportError("请输入有效的图片地址。");
      return;
    }

    editorRef.current
      ?.chain()
      .focus()
      .setImage({ src: url, alt: "插入图片" })
      .run();
  }, [reportError]);

  const handleFileSelection = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const updateHoveredBlock = useCallback(
    (target: EventTarget | null) => {
      const currentEditor = editorRef.current;
      const surface = editorSurfaceRef.current;

      if (!(target instanceof HTMLElement) || !currentEditor || !surface) {
        return;
      }

      if (target.closest("[data-editor-insert-controls='true']")) {
        return;
      }

      const block = target.closest(
        "p, h1, h2, h3, ul, ol, blockquote, pre, hr, img"
      );

      if (!(block instanceof HTMLElement) || !currentEditor.view.dom.contains(block)) {
        setHoveredBlock(null);
        return;
      }

      try {
        const pos = currentEditor.view.posAtDOM(block, 0);
        const blockRect = block.getBoundingClientRect();
        const surfaceRect = surface.getBoundingClientRect();
        const nextState = {
          pos,
          buttonTop:
            blockRect.top - surfaceRect.top + blockRect.height / 2 - 16,
          menuTop: blockRect.top + blockRect.height / 2 - 12,
          menuLeft: blockRect.left - 20,
          top: blockRect.top - surfaceRect.top,
          bottom: blockRect.bottom - surfaceRect.top,
          contentLeft: blockRect.left - surfaceRect.left,
        };

        setHoveredBlock((previous) => {
          if (
            previous?.pos === nextState.pos &&
            previous.buttonTop === nextState.buttonTop &&
            previous.top === nextState.top &&
            previous.bottom === nextState.bottom
          ) {
            hoveredBlockRef.current = previous;
            return previous;
          }

          hoveredBlockRef.current = nextState;
          return nextState;
        });
      } catch {
        setHoveredBlock(null);
        hoveredBlockRef.current = null;
      }
    },
    []
  );

  const handleSurfaceMouseMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const surface = editorSurfaceRef.current;
      const previous = hoveredBlockRef.current;

      if (surface && previous) {
        const surfaceRect = surface.getBoundingClientRect();
        const relativeX = event.clientX - surfaceRect.left;
        const relativeY = event.clientY - surfaceRect.top;
        const withinSameBand =
          relativeY >= previous.top - 6 && relativeY <= previous.bottom + 6;
        const withinGutter =
          relativeX >= -56 && relativeX <= previous.contentLeft + 12;

        if (
          event.target instanceof HTMLElement &&
          !event.target.closest(
            "p, h1, h2, h3, ul, ol, blockquote, pre, hr, img"
          ) &&
          !event.target.closest("[data-editor-insert-controls='true']") &&
          withinSameBand &&
          withinGutter
        ) {
          return;
        }
      }

      updateHoveredBlock(event.target);

      if (
        surface &&
        previous &&
        event.target instanceof HTMLElement &&
        !event.target.closest(
          "p, h1, h2, h3, ul, ol, blockquote, pre, hr, img"
        ) &&
        !event.target.closest("[data-editor-insert-controls='true']")
      ) {
        const surfaceRect = surface.getBoundingClientRect();
        const relativeY = event.clientY - surfaceRect.top;
        const relativeX = event.clientX - surfaceRect.left;
        const withinSameBand =
          relativeY >= previous.top - 6 && relativeY <= previous.bottom + 6;
        const withinGutter =
          relativeX >= -56 && relativeX <= previous.contentLeft + 12;

        if (!withinSameBand || !withinGutter) {
          hoveredBlockRef.current = null;
          setHoveredBlock(null);
        }
      }
    },
    [updateHoveredBlock]
  );

  const handleSurfaceMouseLeave = useCallback(() => {
    setHoveredBlock(null);
    hoveredBlockRef.current = null;
  }, []);

  const handleOpenBlockMenu = useCallback(() => {
    const currentEditor = editorRef.current;

    if (!currentEditor || !hoveredBlock) return;

    setSlashCoords(null);
    setSlashQuery("");
    setBlockMenuCoords({
      top: hoveredBlock.menuTop,
      left: hoveredBlock.menuLeft,
    });

    try {
      currentEditor.chain().focus(hoveredBlock.pos).run();
    } catch {
      currentEditor.chain().focus().run();
    }
  }, [hoveredBlock]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") {
            return `标题 ${node.attrs.level}`;
          }

          return placeholder;
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: false }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline underline-offset-4 cursor-pointer",
        },
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: "notion-editor-image",
        },
        resize: {
          enabled: true,
          minWidth: 180,
          minHeight: 120,
          alwaysPreserveAspectRatio: true,
        },
      }),
      CodeBlockLowlight.configure({ lowlight }),
      Typography,
      slashCommandExtension,
    ],
    content: parseEditorContent(content),
    editable,
    onUpdate: ({ editor: currentEditor }) => {
      const json = JSON.stringify(currentEditor.getJSON());
      const text = currentEditor.getText({ blockSeparator: "\n" });
      onChange?.(json, text);
    },
    editorProps: {
      attributes: {
        class:
          "notion-editor focus:outline-none min-h-[60vh] px-1 py-2 data-[placeholder]:text-stone-400",
      },
      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files ?? []).filter(
          (file) => file.type.startsWith("image/")
        );

        if (!files.length) return false;

        void (async () => {
          const sources: string[] = [];

          for (const file of files) {
            const error = validateImageFile(file);
            if (error) {
              reportError(error);
              return;
            }

            sources.push(await readFileAsDataUrl(file));
          }

          insertImagesIntoView(view, sources);
        })().catch(() => {
          reportError("插入图片失败，请重试。");
        });

        return true;
      },
      handleDrop(view, event) {
        const files = Array.from(event.dataTransfer?.files ?? []).filter(
          (file) => file.type.startsWith("image/")
        );

        if (!files.length) return false;

        const coordinates = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });

        void (async () => {
          const sources: string[] = [];

          for (const file of files) {
            const error = validateImageFile(file);
            if (error) {
              reportError(error);
              return;
            }

            sources.push(await readFileAsDataUrl(file));
          }

          insertImagesIntoView(view, sources, coordinates?.pos);
        })().catch(() => {
          reportError("插入图片失败，请重试。");
        });

        event.preventDefault();
        return true;
      },
    },
  });
  editorRef.current = editor;

  const commandGroups = useMemo(
    () =>
      createEditorCommandGroups({
        onRequestImageUpload: handleFileSelection,
        onRequestImageUrl: insertImageFromUrl,
      }),
    [handleFileSelection, insertImageFromUrl]
  );

  const slashItems = useMemo(
    () => flattenEditorCommandGroups(commandGroups),
    [commandGroups]
  );

  const handleImageInputChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      const currentEditor = editorRef.current;

      if (!files.length || !currentEditor) {
        event.target.value = "";
        return;
      }

      try {
        const sources: string[] = [];

        for (const file of files) {
          const error = validateImageFile(file);
          if (error) {
            reportError(error);
            return;
          }

          sources.push(await readFileAsDataUrl(file));
        }

        insertImagesIntoView(currentEditor.view, sources);
      } catch {
        reportError("插入图片失败，请重试。");
      } finally {
        event.target.value = "";
      }
    },
    [reportError]
  );

  if (!editor) return null;

  return (
    <div className="relative">
      {editable && <BubbleToolbar editor={editor} />}

      <div
        ref={editorSurfaceRef}
        className="relative"
        onMouseMove={editable ? handleSurfaceMouseMove : undefined}
        onMouseLeave={editable ? handleSurfaceMouseLeave : undefined}
      >
        {editable && hoveredBlock && (
          <div
            data-editor-insert-controls="true"
            className="absolute -left-11 z-20 flex items-center gap-1"
            style={{ top: hoveredBlock.buttonTop }}
          >
            <button
              type="button"
              aria-label="插入块"
              title="插入块"
              data-testid="editor-insert-trigger"
              onMouseDown={(event) => {
                event.preventDefault();
                handleOpenBlockMenu();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-900 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-400 dark:hover:border-stone-700 dark:hover:text-stone-100"
            >
              <Plus size={15} />
            </button>
            <div className="flex h-8 w-6 items-center justify-center text-stone-300 dark:text-stone-700">
              <GripVertical size={14} />
            </div>
          </div>
        )}

        <div className="bg-transparent px-1">
          <EditorContent editor={editor} />
        </div>
      </div>

      {slashCoords && (
        <SlashCommandMenu
          key={`slash-${slashQuery}`}
          editor={editor}
          coords={slashCoords}
          query={slashQuery}
          items={slashItems}
          onClose={handleSlashDeactivate}
        />
      )}

      {blockMenuCoords && (
        <SlashCommandMenu
          key={`block-${blockMenuCoords.top}-${blockMenuCoords.left}`}
          editor={editor}
          coords={blockMenuCoords}
          query=""
          items={slashItems}
          deleteTrigger={false}
          onClose={() => setBlockMenuCoords(null)}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        data-testid="editor-image-input"
        onChange={handleImageInputChange}
      />
    </div>
  );
}
