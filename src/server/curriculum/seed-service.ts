import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  curriculumTracks,
  curriculumAreas,
  curriculumTopics,
  curriculumTopicNotes,
  curriculumTopicGeneralNotes,
  type LinkSource,
} from "../db/schema/curriculum";
import { learningNotes } from "../db/schema/learning";
import { notes as generalNotes } from "../db/schema/notes";
import { DEFAULT_CURRICULUM } from "./seed-data";

export type NoteKind = "learning" | "general";

type TopicWithKeywords = {
  id: string;
  title: string;
  keywords: string[];
};

const STOPWORDS = new Set([
  "the", "is", "a", "an", "of", "and", "or", "to", "in", "for", "with", "vs",
  "什么", "怎么", "如何", "为什么", "是", "的", "了", "和", "与", "在",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[【】（）()｜|·,，.。:：;；!！?？'"`~\-_/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  const norm = normalize(s);
  const tokens: string[] = [];

  for (const m of norm.matchAll(/[a-z0-9+#.]+/g)) {
    if (m[0].length >= 2 && !STOPWORDS.has(m[0])) tokens.push(m[0]);
  }

  const cjkOnly = norm.replace(/[^一-鿿]+/g, " ");
  for (const segment of cjkOnly.split(" ")) {
    for (let i = 0; i + 1 < segment.length; i++) {
      const bigram = segment.slice(i, i + 2);
      if (!STOPWORDS.has(bigram)) tokens.push(bigram);
    }
  }

  return tokens;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return inter / union;
}

// Returns the match source if matched, or null. "auto_substring" is the
// strongest auto signal (explicit keyword hit); "auto_jaccard" is fuzzier.
function matchTopic(noteTitle: string, topic: TopicWithKeywords): LinkSource | null {
  const noteNorm = normalize(noteTitle);
  for (const kw of topic.keywords) {
    if (kw && noteNorm.includes(normalize(kw))) return "auto_substring";
  }
  const noteTokens = new Set(tokenize(noteTitle));
  const topicTokens = new Set(tokenize(topic.title));
  if (jaccard(noteTokens, topicTokens) >= 0.55) return "auto_jaccard";
  return null;
}

export async function userHasCurriculum(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: curriculumTracks.id })
    .from(curriculumTracks)
    .where(eq(curriculumTracks.userId, userId))
    .limit(1);
  return rows.length > 0;
}

export async function seedDefaultCurriculum(userId: string): Promise<void> {
  const trackInserts: typeof curriculumTracks.$inferInsert[] = [];
  const areaInserts: typeof curriculumAreas.$inferInsert[] = [];
  const topicInserts: typeof curriculumTopics.$inferInsert[] = [];
  const topicSeeds: TopicWithKeywords[] = [];

  for (let t = 0; t < DEFAULT_CURRICULUM.length; t++) {
    const track = DEFAULT_CURRICULUM[t];
    const trackId = crypto.randomUUID();
    trackInserts.push({
      id: trackId,
      userId,
      title: track.title,
      description: track.description,
      icon: track.icon,
      orderIndex: t,
    });

    for (let a = 0; a < track.areas.length; a++) {
      const area = track.areas[a];
      const areaId = crypto.randomUUID();
      areaInserts.push({
        id: areaId,
        trackId,
        title: area.title,
        description: area.description,
        orderIndex: a,
      });

      for (let p = 0; p < area.topics.length; p++) {
        const topic = area.topics[p];
        const topicId = crypto.randomUUID();
        topicInserts.push({
          id: topicId,
          areaId,
          title: topic.title,
          description: topic.description,
          orderIndex: p,
        });
        topicSeeds.push({
          id: topicId,
          title: topic.title,
          keywords: topic.keywords ?? [],
        });
      }
    }
  }

  await db.insert(curriculumTracks).values(trackInserts);
  if (areaInserts.length > 0) await db.insert(curriculumAreas).values(areaInserts);
  if (topicInserts.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < topicInserts.length; i += chunkSize) {
      await db.insert(curriculumTopics).values(topicInserts.slice(i, i + chunkSize));
    }
  }

  await autoLinkExistingNotes(userId, topicSeeds, "learning");
  await autoLinkExistingNotes(userId, topicSeeds, "general");
}

async function autoLinkExistingNotes(
  userId: string,
  topics: TopicWithKeywords[],
  kind: NoteKind
): Promise<void> {
  if (topics.length === 0) return;

  const noteRows =
    kind === "learning"
      ? await db
          .select({ id: learningNotes.id, title: learningNotes.title })
          .from(learningNotes)
          .where(eq(learningNotes.userId, userId))
      : await db
          .select({ id: generalNotes.id, title: generalNotes.title })
          .from(generalNotes)
          .where(eq(generalNotes.userId, userId));

  if (noteRows.length === 0) return;

  type LinkRow = { topicId: string; noteId: string; source: LinkSource };
  const links: LinkRow[] = [];
  const matchedTopicIds = new Set<string>();

  for (const note of noteRows) {
    if (!note.title?.trim()) continue;
    for (const topic of topics) {
      const source = matchTopic(note.title, topic);
      if (source) {
        links.push({ topicId: topic.id, noteId: note.id, source });
        matchedTopicIds.add(topic.id);
      }
    }
  }

  if (links.length > 0) {
    const target =
      kind === "learning" ? curriculumTopicNotes : curriculumTopicGeneralNotes;
    const chunkSize = 200;
    for (let i = 0; i < links.length; i += chunkSize) {
      await db.insert(target).values(links.slice(i, i + chunkSize)).onConflictDoNothing();
    }
  }

  if (matchedTopicIds.size > 0) {
    await db
      .update(curriculumTopics)
      .set({ mastery: "learning" })
      .where(
        and(
          inArray(curriculumTopics.id, Array.from(matchedTopicIds)),
          eq(curriculumTopics.mastery, "blank")
        )
      );
  }
}

export async function ensureCurriculumSeeded(userId: string): Promise<void> {
  if (await userHasCurriculum(userId)) return;
  await seedDefaultCurriculum(userId);
}

export async function resetCurriculum(userId: string): Promise<void> {
  await db.delete(curriculumTracks).where(eq(curriculumTracks.userId, userId));
  await seedDefaultCurriculum(userId);
}

// Auto-link a single note (learning or general). Idempotent.
// Returns count of new links inserted.
export async function autoLinkNote(
  userId: string,
  noteId: string,
  noteTitle: string,
  kind: NoteKind = "learning"
): Promise<number> {
  if (!noteTitle?.trim()) return 0;

  const topicRows = await db
    .select({ id: curriculumTopics.id, title: curriculumTopics.title })
    .from(curriculumTopics)
    .innerJoin(curriculumAreas, eq(curriculumAreas.id, curriculumTopics.areaId))
    .innerJoin(curriculumTracks, eq(curriculumTracks.id, curriculumAreas.trackId))
    .where(eq(curriculumTracks.userId, userId));

  if (topicRows.length === 0) return 0;

  const titleToKeywords = new Map<string, string[]>();
  for (const track of DEFAULT_CURRICULUM) {
    for (const area of track.areas) {
      for (const topic of area.topics) {
        titleToKeywords.set(topic.title, topic.keywords ?? []);
      }
    }
  }

  const matched: { topicId: string; source: LinkSource }[] = [];
  for (const t of topicRows) {
    const candidate: TopicWithKeywords = {
      id: t.id,
      title: t.title,
      keywords: titleToKeywords.get(t.title) ?? [],
    };
    const source = matchTopic(noteTitle, candidate);
    if (source) matched.push({ topicId: t.id, source });
  }

  if (matched.length === 0) return 0;

  const target = kind === "learning" ? curriculumTopicNotes : curriculumTopicGeneralNotes;

  const before =
    kind === "learning"
      ? await db
          .select({ topicId: curriculumTopicNotes.topicId })
          .from(curriculumTopicNotes)
          .where(eq(curriculumTopicNotes.noteId, noteId))
      : await db
          .select({ topicId: curriculumTopicGeneralNotes.topicId })
          .from(curriculumTopicGeneralNotes)
          .where(eq(curriculumTopicGeneralNotes.noteId, noteId));
  const existing = new Set(before.map((r) => r.topicId));

  const inserts = matched
    .filter((m) => !existing.has(m.topicId))
    .map((m) => ({ topicId: m.topicId, noteId, source: m.source }));

  if (inserts.length === 0) return 0;

  await db.insert(target).values(inserts).onConflictDoNothing();

  await db
    .update(curriculumTopics)
    .set({ mastery: "learning" })
    .where(
      and(
        inArray(
          curriculumTopics.id,
          inserts.map((i) => i.topicId)
        ),
        eq(curriculumTopics.mastery, "blank")
      )
    );

  return inserts.length;
}

// Re-run auto-link for both kinds against the user's current notes.
export async function rerunAutoLink(userId: string): Promise<number> {
  const topicRows = await db
    .select({ id: curriculumTopics.id, title: curriculumTopics.title })
    .from(curriculumTopics)
    .innerJoin(curriculumAreas, eq(curriculumAreas.id, curriculumTopics.areaId))
    .innerJoin(curriculumTracks, eq(curriculumTracks.id, curriculumAreas.trackId))
    .where(eq(curriculumTracks.userId, userId));

  const titleToKeywords = new Map<string, string[]>();
  for (const track of DEFAULT_CURRICULUM) {
    for (const area of track.areas) {
      for (const topic of area.topics) {
        titleToKeywords.set(topic.title, topic.keywords ?? []);
      }
    }
  }

  const topics: TopicWithKeywords[] = topicRows.map((r) => ({
    id: r.id,
    title: r.title,
    keywords: titleToKeywords.get(r.title) ?? [],
  }));

  const linkCountForUser = async () => {
    const learning = await db
      .select({ count: sql<number>`count(*)` })
      .from(curriculumTopicNotes)
      .innerJoin(curriculumTopics, eq(curriculumTopics.id, curriculumTopicNotes.topicId))
      .innerJoin(curriculumAreas, eq(curriculumAreas.id, curriculumTopics.areaId))
      .innerJoin(curriculumTracks, eq(curriculumTracks.id, curriculumAreas.trackId))
      .where(eq(curriculumTracks.userId, userId));
    const general = await db
      .select({ count: sql<number>`count(*)` })
      .from(curriculumTopicGeneralNotes)
      .innerJoin(
        curriculumTopics,
        eq(curriculumTopics.id, curriculumTopicGeneralNotes.topicId)
      )
      .innerJoin(curriculumAreas, eq(curriculumAreas.id, curriculumTopics.areaId))
      .innerJoin(curriculumTracks, eq(curriculumTracks.id, curriculumAreas.trackId))
      .where(eq(curriculumTracks.userId, userId));
    return (learning[0]?.count ?? 0) + (general[0]?.count ?? 0);
  };

  const before = await linkCountForUser();
  await autoLinkExistingNotes(userId, topics, "learning");
  await autoLinkExistingNotes(userId, topics, "general");
  const after = await linkCountForUser();

  return after - before;
}
