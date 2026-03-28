export interface AskAiSource {
  id: string;
  type: "note" | "bookmark";
  title: string;
}

export const ASK_AI_SOURCE_SCOPES = [
  "all",
  "notes",
  "bookmarks",
  "direct",
] as const;

export type AskAiSourceScope = (typeof ASK_AI_SOURCE_SCOPES)[number];

export const ASK_AI_SCOPE_OPTIONS: Array<{
  value: AskAiSourceScope;
  label: string;
  description: string;
}> = [
  {
    value: "all",
    label: "All sources",
    description: "Search notes and bookmarks together for broader questions.",
  },
  {
    value: "notes",
    label: "Notes only",
    description: "Best for summaries, meeting notes, and longer writing.",
  },
  {
    value: "direct",
    label: "Direct answer",
    description: "Skip the knowledge base and answer like a standard assistant.",
  },
];

const COMPLETE_SOURCES_REGEX =
  /\n?\s*<!--\s*sources:\s*(\[[\s\S]*?\])\s*-->\s*$/;

const PARTIAL_SOURCES_REGEX = /\n?\s*<!--\s*sources:[\s\S]*$/;

export function parseAssistantResponse(text: string): {
  cleanText: string;
  sources: AskAiSource[];
} {
  const completeMatch = text.match(COMPLETE_SOURCES_REGEX);
  if (completeMatch?.index != null) {
    const cleanText = text.slice(0, completeMatch.index).trimEnd();

    try {
      return {
        cleanText,
        sources: JSON.parse(completeMatch[1]) as AskAiSource[],
      };
    } catch {
      return { cleanText, sources: [] };
    }
  }

  const partialMatch = text.match(PARTIAL_SOURCES_REGEX);
  if (partialMatch?.index != null) {
    return {
      cleanText: text.slice(0, partialMatch.index).trimEnd(),
      sources: [],
    };
  }

  return { cleanText: text, sources: [] };
}

export function stripAssistantSourceMetadata(text: string) {
  return parseAssistantResponse(text).cleanText;
}
