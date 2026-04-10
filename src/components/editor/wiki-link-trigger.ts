import { Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/**
 * Tiptap extension that detects `[[` input and triggers a wiki-link
 * autocomplete popover via callbacks. Similar pattern to slash-command.
 */
export function createWikiLinkTriggerExtension(
  onActivate: (query: string, coords: { top: number; left: number }) => void,
  onDeactivate: () => void,
  onQueryChange: (query: string) => void
) {
  let isActive = false;
  let queryStart = 0; // cursor position right after `[[`

  return Extension.create({
    name: "wikiLinkTrigger",

    addKeyboardShortcuts() {
      return {
        Escape: () => {
          if (isActive) {
            isActive = false;
            onDeactivate();
            return true;
          }
          return false;
        },
      };
    },

    onUpdate({ editor }) {
      if (!isActive) return;

      const { state } = editor;
      const { from } = state.selection;

      // Check if we're still after the `[[`
      if (from < queryStart) {
        isActive = false;
        onDeactivate();
        return;
      }

      const textAfterBrackets = state.doc.textBetween(queryStart, from, "\n", " ");

      // If user typed `]]`, close and don't insert (the mark is already handled)
      if (textAfterBrackets.includes("]]")) {
        isActive = false;
        onDeactivate();
        return;
      }

      onQueryChange(textAfterBrackets);
    },

    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey("wikiLinkTrigger"),
          props: {
            handleTextInput(view: EditorView, from: number, _to: number, text: string) {
              // Detect the second `[` of `[[`
              if (text !== "[" || isActive) return false;

              const { state } = view;
              const $pos = state.doc.resolve(from);
              const textBefore = $pos.parent.textContent.slice(0, $pos.parentOffset);

              // Check if the character before cursor is already `[`
              if (textBefore.endsWith("[")) {
                const coords = view.coordsAtPos(from);
                isActive = true;
                // queryStart = position right after `[[` (the second `[` hasn't been inserted yet,
                // but it will be at `from + 1` after this handler returns false)
                queryStart = from + 1;

                setTimeout(() => {
                  onActivate("", {
                    top: coords.bottom + 8,
                    left: coords.left,
                  });
                }, 0);
              }

              return false; // let the character be inserted normally
            },
          },
        }),
      ];
    },

    onSelectionUpdate({ editor }) {
      if (!isActive) return;

      const { from } = editor.state.selection;
      if (from < queryStart) {
        isActive = false;
        onDeactivate();
      }
    },
  });
}
