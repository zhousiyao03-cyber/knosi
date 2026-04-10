import { Mark, mergeAttributes } from "@tiptap/react";

export interface WikiLinkOptions {
  HTMLAttributes: Record<string, unknown>;
}

/**
 * A custom Tiptap Mark for `[[wiki-link]]` style references between notes.
 *
 * Stores noteId and noteTitle as mark attributes. Renders as a styled
 * inline link with `data-wiki-link` attribute for easy identification.
 *
 * Usage from editor: `editor.chain().focus().setMark('wikiLink', { noteId, noteTitle }).run()`
 */
export const WikiLink = Mark.create<WikiLinkOptions>({
  name: "wikiLink",

  priority: 1000,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      noteId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-note-id"),
        renderHTML: (attrs: Record<string, unknown>) => ({
          "data-note-id": attrs.noteId,
        }),
      },
      noteTitle: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-note-title"),
        renderHTML: (attrs: Record<string, unknown>) => ({
          "data-note-title": attrs.noteTitle,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-wiki-link]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-wiki-link": "",
        class:
          "wiki-link cursor-pointer rounded bg-blue-50 px-1 py-0.5 text-blue-700 no-underline transition-colors hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50",
      }),
      0,
    ];
  },
});
