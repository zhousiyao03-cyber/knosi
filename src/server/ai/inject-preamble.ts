import type { ModelMessage } from "ai";

/**
 * Returns a new ModelMessage[] where `preamble` has been prepended onto the
 * content of the most recent user message. Other messages (and the input
 * array) are not mutated. If the messages array contains no user role, or
 * `preamble` is the empty string, the input is returned (still as a fresh
 * array reference, for immutability).
 *
 * Supports both string content and the structured parts-array content shape
 * used by the AI SDK (UIMessage / ModelMessage).
 */
export function injectPreambleIntoLatestUser(
  messages: ModelMessage[],
  preamble: string
): ModelMessage[] {
  const next = [...messages];
  if (!preamble) return next;

  let lastUserIdx = -1;
  for (let i = next.length - 1; i >= 0; i--) {
    if (next[i].role === "user") {
      lastUserIdx = i;
      break;
    }
  }
  if (lastUserIdx === -1) return next;

  const target = next[lastUserIdx] as ModelMessage & { role: "user" };
  if (typeof target.content === "string") {
    next[lastUserIdx] = {
      ...target,
      content: `${preamble}${target.content}`,
    };
    return next;
  }

  const parts = [
    ...(target.content as Array<{ type: string; text?: string }>),
  ];
  const firstTextIdx = parts.findIndex((p) => p && p.type === "text");
  if (firstTextIdx === -1) {
    parts.unshift({ type: "text", text: preamble });
  } else {
    const part = parts[firstTextIdx];
    parts[firstTextIdx] = {
      ...part,
      text: `${preamble}${(part as { text?: string }).text ?? ""}`,
    };
  }
  // Cast through unknown because the AI SDK's user-content union is a strict
  // discriminated set (text | image | file). Our parts array preserves the
  // shape we received, so this is safe.
  next[lastUserIdx] = {
    ...target,
    content: parts as unknown as (ModelMessage & { role: "user" })["content"],
  };
  return next;
}
