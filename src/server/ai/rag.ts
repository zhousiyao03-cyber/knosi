import { eq } from "drizzle-orm";
import { db } from "../db";
import { bookmarks, notes } from "../db/schema";
import type { AskAiSourceScope } from "@/lib/ask-ai";

export interface RetrievalResult {
  id: string;
  type: "note" | "bookmark";
  title: string;
  content: string;
  matchScore: number;
}

interface SearchRecord {
  id: string;
  type: "note" | "bookmark";
  title: string;
  content: string;
  searchable: string;
  normalizedTitle: string;
  updatedAt: number;
}

interface QueryProfile {
  normalized: string;
  terms: string[];
  prefersRecent: boolean;
  prefersSummary: boolean;
  preferredType: "note" | "bookmark" | null;
}

interface RetrieveContextOptions {
  scope?: AskAiSourceScope;
  /**
   * User whose knowledge base we are searching. **Required for correctness /
   * safety** — RAG must never leak another user's notes or bookmarks. If
   * omitted, retrieval returns an empty array (fail-closed).
   */
  userId?: string | null;
}

const MAX_RESULTS = 5;
const MAX_CONTENT_LENGTH = 2000;
const MIN_TERM_LENGTH = 2;
const MAX_CJK_TERM_LENGTH = 4;

const RECENT_QUERY_REGEX = /最近|最新|近期|刚刚|这几天|最近的/;
const SUMMARY_QUERY_REGEX = /总结|概括|汇总|回顾|梳理|整理|盘点|归纳/;
const NOTES_QUERY_REGEX = /笔记|note/;
const BOOKMARKS_QUERY_REGEX = /收藏|书签|链接|网址|bookmark/;
const LATIN_TERM_REGEX = /[a-z0-9][a-z0-9-]{1,}/gi;
const CJK_SEGMENT_REGEX = /[\u3400-\u9fff]+/g;

const QUERY_NOISE_PATTERNS = [
  /帮我/g,
  /一下/g,
  /请问/g,
  /麻烦/g,
  /可以/g,
  /能够/g,
  /能不能/g,
  /一下子/g,
  /我的/g,
  /这个/g,
  /那个/g,
  /请/g,
];

const GENERIC_CJK_TERMS = new Set([
  "一下",
  "帮我",
  "请问",
  "麻烦",
  "可以",
  "能够",
  "最近",
  "这个",
  "那个",
  "我的",
  "一下子",
]);

function normalizeText(text: string | null | undefined) {
  return (text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function uniqueTerms(terms: string[]) {
  return [...new Set(terms.filter((term) => term.length >= MIN_TERM_LENGTH))]
    .sort((a, b) => b.length - a.length)
    .slice(0, 18);
}

function extractAsciiTerms(query: string) {
  return uniqueTerms(query.match(LATIN_TERM_REGEX) ?? []);
}

function cleanCjkSegment(segment: string) {
  let cleaned = segment;
  for (const pattern of QUERY_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned.trim();
}

function extractCjkTerms(query: string) {
  const segments = query.match(CJK_SEGMENT_REGEX) ?? [];
  const terms: string[] = [];

  for (const rawSegment of segments) {
    const segment = cleanCjkSegment(rawSegment);
    if (segment.length < MIN_TERM_LENGTH) continue;

    if (!GENERIC_CJK_TERMS.has(segment)) {
      terms.push(segment);
    }

    const maxLength = Math.min(MAX_CJK_TERM_LENGTH, segment.length);
    for (let size = maxLength; size >= MIN_TERM_LENGTH; size -= 1) {
      for (let index = 0; index <= segment.length - size; index += 1) {
        const term = segment.slice(index, index + size);
        if (!GENERIC_CJK_TERMS.has(term)) {
          terms.push(term);
        }
      }
    }
  }

  return uniqueTerms(terms);
}

function buildQueryProfile(query: string): QueryProfile {
  const normalized = normalizeText(query);
  const prefersNotes = NOTES_QUERY_REGEX.test(normalized);
  const prefersBookmarks = BOOKMARKS_QUERY_REGEX.test(normalized);

  return {
    normalized,
    terms: uniqueTerms([
      ...extractAsciiTerms(normalized),
      ...extractCjkTerms(query),
    ]),
    prefersRecent: RECENT_QUERY_REGEX.test(query),
    prefersSummary: SUMMARY_QUERY_REGEX.test(query),
    preferredType:
      prefersNotes === prefersBookmarks
        ? null
        : prefersNotes
          ? "note"
          : "bookmark",
  };
}

function toTimestamp(value: Date | string | number | null | undefined) {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

function getRecentBoost(updatedAt: number) {
  if (!updatedAt) return 0;

  const ageInDays = (Date.now() - updatedAt) / (1000 * 60 * 60 * 24);
  if (ageInDays <= 1) return 6;
  if (ageInDays <= 7) return 4;
  if (ageInDays <= 30) return 2;
  return 0;
}

function getContentExcerpt(content: string, terms: string[]) {
  if (content.length <= MAX_CONTENT_LENGTH) {
    return content;
  }

  const normalizedContent = content.toLowerCase();
  const firstMatch = terms
    .map((term) => normalizedContent.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (firstMatch == null) {
    return content.slice(0, MAX_CONTENT_LENGTH);
  }

  const start = Math.max(0, firstMatch - 240);
  const end = Math.min(content.length, start + MAX_CONTENT_LENGTH);

  return `${start > 0 ? "..." : ""}${content.slice(start, end).trim()}${
    end < content.length ? "..." : ""
  }`;
}

function scoreRecord(record: SearchRecord, profile: QueryProfile) {
  let score = 0;
  let matchedTerms = 0;

  if (
    profile.normalized &&
    record.normalizedTitle &&
    record.normalizedTitle.includes(profile.normalized)
  ) {
    score += 18;
  }

  for (const term of profile.terms) {
    const isInTitle = record.normalizedTitle.includes(term);
    const isInContent = record.searchable.includes(term);

    if (!isInTitle && !isInContent) continue;

    matchedTerms += 1;
    const lengthBoost = Math.min(term.length, 6);
    score += isInTitle ? 8 + lengthBoost : 3 + lengthBoost / 2;
  }

  if (matchedTerms === 0) {
    return 0;
  }

  score += matchedTerms * 2;

  if (profile.preferredType === record.type) {
    score += 3;
  }

  if (profile.prefersRecent) {
    score += getRecentBoost(record.updatedAt);
  }

  if (profile.prefersSummary && record.content.length >= 160) {
    score += 2;
  }

  return score;
}

function toRetrievalResult(
  record: SearchRecord,
  profile: QueryProfile,
  matchScore: number
): RetrievalResult {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    content: getContentExcerpt(record.content, profile.terms),
    matchScore,
  };
}

function shouldUseRecentFallback(profile: QueryProfile) {
  if (!profile.prefersRecent) {
    return false;
  }

  return profile.prefersSummary || profile.preferredType !== null;
}

function resolvePreferredType(
  profile: QueryProfile,
  scope: AskAiSourceScope | undefined
) {
  if (scope === "notes") return "note";
  if (scope === "bookmarks") return "bookmark";
  return profile.preferredType;
}

function matchesScope(
  record: SearchRecord,
  scope: AskAiSourceScope | undefined
) {
  if (!scope || scope === "all") return true;
  if (scope === "notes") return record.type === "note";
  if (scope === "bookmarks") return record.type === "bookmark";
  return false;
}

export async function retrieveContext(
  query: string,
  options: RetrieveContextOptions = {}
): Promise<RetrievalResult[]> {
  // Fail-closed: without a userId we cannot scope results safely.
  if (!options.userId) {
    return [];
  }

  const profile = buildQueryProfile(query);
  const preferredType = resolvePreferredType(profile, options.scope);

  const allNotes = await db
    .select()
    .from(notes)
    .where(eq(notes.userId, options.userId));
  const allBookmarks = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.userId, options.userId));

  const records: SearchRecord[] = [
    ...allNotes.map((note) => {
      const content = (note.plainText ?? "").trim();

      return {
        id: note.id,
        type: "note" as const,
        title: note.title,
        content,
        searchable: normalizeText([note.title, note.plainText].join(" ")),
        normalizedTitle: normalizeText(note.title),
        updatedAt: toTimestamp(note.updatedAt),
      };
    }),
    ...allBookmarks.map((bookmark) => {
      const title = bookmark.title ?? bookmark.url ?? "无标题";
      const content = (bookmark.content ?? bookmark.summary ?? "").trim();

      return {
        id: bookmark.id,
        type: "bookmark" as const,
        title,
        content,
        searchable: normalizeText(
          [bookmark.title, bookmark.url, bookmark.content, bookmark.summary].join(
            " "
          )
        ),
        normalizedTitle: normalizeText(title),
        updatedAt: toTimestamp(bookmark.updatedAt),
      };
    }),
  ];

  const scopedRecords = records.filter((record) =>
    matchesScope(record, options.scope)
  );

  if (profile.terms.length > 0) {
    const scoredResults = scopedRecords
      .map((record) => ({
        record,
        matchScore: scoreRecord(record, {
          ...profile,
          preferredType,
        }),
      }))
      .filter(({ matchScore }) => matchScore > 0)
      .sort((left, right) => right.matchScore - left.matchScore)
      .slice(0, MAX_RESULTS)
      .map(({ record, matchScore }) =>
        toRetrievalResult(
          record,
          {
            ...profile,
            preferredType,
          },
          matchScore
        )
      );

    if (scoredResults.length > 0) {
      return scoredResults;
    }
  }

  if (
    !shouldUseRecentFallback({
      ...profile,
      preferredType,
    })
  ) {
    return [];
  }

  return scopedRecords
    .filter((record) => (preferredType ? record.type === preferredType : true))
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_RESULTS)
    .map((record, index) =>
      toRetrievalResult(
        record,
        {
          ...profile,
          preferredType,
        },
        MAX_RESULTS - index
      )
    );
}
