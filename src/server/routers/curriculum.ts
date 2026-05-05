import { and, asc, eq, inArray, like, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "../db";
import {
  curriculumAreas,
  curriculumTopicNotes,
  curriculumTopics,
  curriculumTracks,
  MASTERY_STATES,
} from "../db/schema/curriculum";
import { learningNotes, learningTopics } from "../db/schema/learning";
import { protectedProcedure, router } from "../trpc";
import {
  ensureCurriculumSeeded,
  resetCurriculum,
  rerunAutoLink,
} from "../curriculum/seed-service";

const masterySchema = z.enum(MASTERY_STATES);

const DEFAULT_FALLBACK_TOPIC_TITLE = "Curriculum Notes";

async function ensureTopicOwnedByUser(topicId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: curriculumTopics.id })
    .from(curriculumTopics)
    .innerJoin(curriculumAreas, eq(curriculumAreas.id, curriculumTopics.areaId))
    .innerJoin(curriculumTracks, eq(curriculumTracks.id, curriculumAreas.trackId))
    .where(and(eq(curriculumTopics.id, topicId), eq(curriculumTracks.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

async function ensureNoteOwnedByUser(noteId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: learningNotes.id })
    .from(learningNotes)
    .where(and(eq(learningNotes.id, noteId), eq(learningNotes.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

async function getOrCreateFallbackLearningTopic(userId: string): Promise<string> {
  const existing = await db
    .select({ id: learningTopics.id })
    .from(learningTopics)
    .where(
      and(
        eq(learningTopics.userId, userId),
        eq(learningTopics.title, DEFAULT_FALLBACK_TOPIC_TITLE)
      )
    )
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const id = crypto.randomUUID();
  await db.insert(learningTopics).values({
    id,
    userId,
    title: DEFAULT_FALLBACK_TOPIC_TITLE,
    description: "Notes created from the curriculum map",
    icon: "🎯",
  });
  return id;
}

export const curriculumRouter = router({
  getCurriculum: protectedProcedure.query(async ({ ctx }) => {
    await ensureCurriculumSeeded(ctx.userId);

    const tracks = await db
      .select()
      .from(curriculumTracks)
      .where(eq(curriculumTracks.userId, ctx.userId))
      .orderBy(asc(curriculumTracks.orderIndex));

    const trackIds = tracks.map((t) => t.id);
    const areas = trackIds.length
      ? await db
          .select()
          .from(curriculumAreas)
          .where(inArray(curriculumAreas.trackId, trackIds))
          .orderBy(asc(curriculumAreas.orderIndex))
      : [];

    const areaIds = areas.map((a) => a.id);
    const topics = areaIds.length
      ? await db
          .select()
          .from(curriculumTopics)
          .where(inArray(curriculumTopics.areaId, areaIds))
          .orderBy(asc(curriculumTopics.orderIndex))
      : [];

    const topicIds = topics.map((t) => t.id);
    const linkRows = topicIds.length
      ? await db
          .select({
            topicId: curriculumTopicNotes.topicId,
            noteId: curriculumTopicNotes.noteId,
            noteTitle: learningNotes.title,
          })
          .from(curriculumTopicNotes)
          .innerJoin(learningNotes, eq(learningNotes.id, curriculumTopicNotes.noteId))
          .where(inArray(curriculumTopicNotes.topicId, topicIds))
      : [];

    const noteCountByTopic = new Map<string, number>();
    for (const r of linkRows) {
      noteCountByTopic.set(r.topicId, (noteCountByTopic.get(r.topicId) ?? 0) + 1);
    }

    const topicsByArea = new Map<string, typeof topics>();
    for (const topic of topics) {
      const list = topicsByArea.get(topic.areaId) ?? [];
      list.push(topic);
      topicsByArea.set(topic.areaId, list);
    }

    const areasByTrack = new Map<string, typeof areas>();
    for (const area of areas) {
      const list = areasByTrack.get(area.trackId) ?? [];
      list.push(area);
      areasByTrack.set(area.trackId, list);
    }

    return {
      tracks: tracks.map((track) => ({
        id: track.id,
        title: track.title,
        description: track.description,
        icon: track.icon,
        areas: (areasByTrack.get(track.id) ?? []).map((area) => ({
          id: area.id,
          title: area.title,
          description: area.description,
          topics: (topicsByArea.get(area.id) ?? []).map((topic) => ({
            id: topic.id,
            title: topic.title,
            description: topic.description,
            mastery: topic.mastery,
            noteCount: noteCountByTopic.get(topic.id) ?? 0,
          })),
        })),
      })),
    };
  }),

  getTopicDetail: protectedProcedure
    .input(z.object({ topicId: z.string() }))
    .query(async ({ ctx, input }) => {
      const owned = await ensureTopicOwnedByUser(input.topicId, ctx.userId);
      if (!owned) throw new Error("Topic not found");

      const topicRows = await db
        .select()
        .from(curriculumTopics)
        .where(eq(curriculumTopics.id, input.topicId))
        .limit(1);
      const topic = topicRows[0];
      if (!topic) throw new Error("Topic not found");

      const linkedNotes = await db
        .select({
          id: learningNotes.id,
          title: learningNotes.title,
          topicId: learningNotes.topicId,
          updatedAt: learningNotes.updatedAt,
        })
        .from(curriculumTopicNotes)
        .innerJoin(learningNotes, eq(learningNotes.id, curriculumTopicNotes.noteId))
        .where(eq(curriculumTopicNotes.topicId, input.topicId));

      return { topic, linkedNotes };
    }),

  setMastery: protectedProcedure
    .input(z.object({ topicId: z.string(), mastery: masterySchema }))
    .mutation(async ({ ctx, input }) => {
      const owned = await ensureTopicOwnedByUser(input.topicId, ctx.userId);
      if (!owned) throw new Error("Topic not found");

      await db
        .update(curriculumTopics)
        .set({ mastery: input.mastery, updatedAt: new Date() })
        .where(eq(curriculumTopics.id, input.topicId));

      return { ok: true };
    }),

  linkNote: protectedProcedure
    .input(z.object({ topicId: z.string(), noteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [topicOk, noteOk] = await Promise.all([
        ensureTopicOwnedByUser(input.topicId, ctx.userId),
        ensureNoteOwnedByUser(input.noteId, ctx.userId),
      ]);
      if (!topicOk || !noteOk) throw new Error("Not found");

      await db
        .insert(curriculumTopicNotes)
        .values({ topicId: input.topicId, noteId: input.noteId })
        .onConflictDoNothing();

      return { ok: true };
    }),

  unlinkNote: protectedProcedure
    .input(z.object({ topicId: z.string(), noteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const owned = await ensureTopicOwnedByUser(input.topicId, ctx.userId);
      if (!owned) throw new Error("Topic not found");

      await db
        .delete(curriculumTopicNotes)
        .where(
          and(
            eq(curriculumTopicNotes.topicId, input.topicId),
            eq(curriculumTopicNotes.noteId, input.noteId)
          )
        );
      return { ok: true };
    }),

  createNoteForTopic: protectedProcedure
    .input(z.object({ topicId: z.string(), title: z.string().trim().optional() }))
    .mutation(async ({ ctx, input }) => {
      const owned = await ensureTopicOwnedByUser(input.topicId, ctx.userId);
      if (!owned) throw new Error("Topic not found");

      const topicRows = await db
        .select({ title: curriculumTopics.title })
        .from(curriculumTopics)
        .where(eq(curriculumTopics.id, input.topicId))
        .limit(1);
      const topicTitle = topicRows[0]?.title ?? "Untitled";

      const learningTopicId = await getOrCreateFallbackLearningTopic(ctx.userId);

      const noteId = crypto.randomUUID();
      const noteTitle = input.title?.trim() || topicTitle;

      await db.insert(learningNotes).values({
        id: noteId,
        topicId: learningTopicId,
        userId: ctx.userId,
        title: noteTitle,
      });

      await db
        .insert(curriculumTopicNotes)
        .values({ topicId: input.topicId, noteId })
        .onConflictDoNothing();

      return { noteId, learningTopicId };
    }),

  getTopicsForNote: protectedProcedure
    .input(z.object({ noteId: z.string() }))
    .query(async ({ ctx, input }) => {
      const owned = await ensureNoteOwnedByUser(input.noteId, ctx.userId);
      if (!owned) return [];

      const rows = await db
        .select({
          id: curriculumTopics.id,
          title: curriculumTopics.title,
          areaTitle: curriculumAreas.title,
          trackTitle: curriculumTracks.title,
          mastery: curriculumTopics.mastery,
        })
        .from(curriculumTopicNotes)
        .innerJoin(curriculumTopics, eq(curriculumTopics.id, curriculumTopicNotes.topicId))
        .innerJoin(curriculumAreas, eq(curriculumAreas.id, curriculumTopics.areaId))
        .innerJoin(curriculumTracks, eq(curriculumTracks.id, curriculumAreas.trackId))
        .where(
          and(
            eq(curriculumTopicNotes.noteId, input.noteId),
            eq(curriculumTracks.userId, ctx.userId)
          )
        );
      return rows;
    }),

  searchTopics: protectedProcedure
    .input(z.object({ query: z.string().trim().optional(), limit: z.number().min(1).max(200).optional() }))
    .query(async ({ ctx, input }) => {
      const q = input.query?.toLowerCase() ?? "";
      const base = db
        .select({
          id: curriculumTopics.id,
          title: curriculumTopics.title,
          mastery: curriculumTopics.mastery,
          areaTitle: curriculumAreas.title,
          areaId: curriculumAreas.id,
          trackId: curriculumTracks.id,
          trackTitle: curriculumTracks.title,
          orderIndex: curriculumTopics.orderIndex,
        })
        .from(curriculumTopics)
        .innerJoin(curriculumAreas, eq(curriculumAreas.id, curriculumTopics.areaId))
        .innerJoin(curriculumTracks, eq(curriculumTracks.id, curriculumAreas.trackId));

      const where = q
        ? and(
            eq(curriculumTracks.userId, ctx.userId),
            or(
              like(sql`lower(${curriculumTopics.title})`, `%${q}%`),
              like(sql`lower(${curriculumAreas.title})`, `%${q}%`)
            )
          )
        : eq(curriculumTracks.userId, ctx.userId);

      const rows = await base
        .where(where)
        .orderBy(
          asc(curriculumTracks.orderIndex),
          asc(curriculumAreas.orderIndex),
          asc(curriculumTopics.orderIndex)
        )
        .limit(input.limit ?? 60);

      return rows;
    }),

  searchUserNotes: protectedProcedure
    .input(
      z.object({
        query: z.string().trim().optional(),
        limit: z.number().int().min(1).max(100).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const q = (input.query ?? "").toLowerCase();
      const baseWhere = q
        ? and(
            eq(learningNotes.userId, ctx.userId),
            like(sql`lower(${learningNotes.title})`, `%${q}%`)
          )
        : eq(learningNotes.userId, ctx.userId);
      const rows = await db
        .select({
          id: learningNotes.id,
          title: learningNotes.title,
          updatedAt: learningNotes.updatedAt,
        })
        .from(learningNotes)
        .where(baseWhere)
        .orderBy(asc(learningNotes.title))
        .limit(input.limit);
      return rows;
    }),

  rerunAutoLink: protectedProcedure.mutation(async ({ ctx }) => {
    const added = await rerunAutoLink(ctx.userId);
    return { added };
  }),

  resetToDefault: protectedProcedure.mutation(async ({ ctx }) => {
    await resetCurriculum(ctx.userId);
    return { ok: true };
  }),
});
