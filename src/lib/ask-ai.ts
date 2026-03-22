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
    label: "全部来源",
    description: "同时搜索笔记和收藏，适合开放式提问。",
  },
  {
    value: "notes",
    label: "只看笔记",
    description: "更适合总结思考、会议记录和长文笔记。",
  },
  {
    value: "bookmarks",
    label: "只看收藏",
    description: "更适合回顾链接、资料和摘录内容。",
  },
  {
    value: "direct",
    label: "直接回答",
    description: "不搜索知识库，像普通聊天助手一样回答。",
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
