import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db } from "../db";
import {
  curriculumAreas,
  curriculumTopicGeneralNotes,
  curriculumTopicNotes,
  curriculumTopics,
  curriculumTracks,
  MASTERY_STATES,
  type LinkSource,
} from "../db/schema/curriculum";
import { learningNotes, learningTopics } from "../db/schema/learning";
import { notes as generalNotes } from "../db/schema/notes";
import { protectedProcedure, router } from "../trpc";
import { generateStructuredData } from "../ai/provider";
import {
  ensureCurriculumSeeded,
  resetCurriculum,
  rerunAutoLink,
} from "../curriculum/seed-service";

const masterySchema = z.enum(MASTERY_STATES);
const kindSchema = z.enum(["learning", "general"]).default("learning");

const DEFAULT_FALLBACK_TOPIC_TITLE = "Curriculum Notes";

// Order links by source confidence: manual > substring > jaccard. Used for the
// side panel so user-curated links appear first and noisy auto links last.
const SOURCE_RANK: Record<LinkSource, number> = {
  manual: 0,
  auto_substring: 1,
  auto_jaccard: 2,
};

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

async function ensureLearningNoteOwnedByUser(noteId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: learningNotes.id })
    .from(learningNotes)
    .where(and(eq(learningNotes.id, noteId), eq(learningNotes.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

async function ensureGeneralNoteOwnedByUser(noteId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: generalNotes.id })
    .from(generalNotes)
    .where(and(eq(generalNotes.id, noteId), eq(generalNotes.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

async function ensureNoteOwnedByUser(
  noteId: string,
  userId: string,
  kind: "learning" | "general"
): Promise<boolean> {
  return kind === "learning"
    ? ensureLearningNoteOwnedByUser(noteId, userId)
    : ensureGeneralNoteOwnedByUser(noteId, userId);
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

    // Combined note count across both link tables.
    const learningLinks = topicIds.length
      ? await db
          .select({ topicId: curriculumTopicNotes.topicId })
          .from(curriculumTopicNotes)
          .where(inArray(curriculumTopicNotes.topicId, topicIds))
      : [];
    const generalLinks = topicIds.length
      ? await db
          .select({ topicId: curriculumTopicGeneralNotes.topicId })
          .from(curriculumTopicGeneralNotes)
          .where(inArray(curriculumTopicGeneralNotes.topicId, topicIds))
      : [];

    const noteCountByTopic = new Map<string, number>();
    for (const r of learningLinks) {
      noteCountByTopic.set(r.topicId, (noteCountByTopic.get(r.topicId) ?? 0) + 1);
    }
    for (const r of generalLinks) {
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

      const learningRows = await db
        .select({
          id: learningNotes.id,
          title: learningNotes.title,
          parentId: learningNotes.topicId,
          updatedAt: learningNotes.updatedAt,
          source: curriculumTopicNotes.source,
        })
        .from(curriculumTopicNotes)
        .innerJoin(learningNotes, eq(learningNotes.id, curriculumTopicNotes.noteId))
        .where(eq(curriculumTopicNotes.topicId, input.topicId));

      const generalRows = await db
        .select({
          id: generalNotes.id,
          title: generalNotes.title,
          updatedAt: generalNotes.updatedAt,
          source: curriculumTopicGeneralNotes.source,
        })
        .from(curriculumTopicGeneralNotes)
        .innerJoin(generalNotes, eq(generalNotes.id, curriculumTopicGeneralNotes.noteId))
        .where(eq(curriculumTopicGeneralNotes.topicId, input.topicId));

      type LinkedNote = {
        id: string;
        title: string;
        kind: "learning" | "general";
        parentId: string | null;
        source: LinkSource;
      };

      const linkedNotes: LinkedNote[] = [
        ...learningRows.map((r) => ({
          id: r.id,
          title: r.title,
          kind: "learning" as const,
          parentId: r.parentId,
          source: r.source as LinkSource,
        })),
        ...generalRows.map((r) => ({
          id: r.id,
          title: r.title,
          kind: "general" as const,
          parentId: null,
          source: r.source as LinkSource,
        })),
      ].sort((a, b) => SOURCE_RANK[a.source] - SOURCE_RANK[b.source]);

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
    .input(z.object({ topicId: z.string(), noteId: z.string(), kind: kindSchema }))
    .mutation(async ({ ctx, input }) => {
      const [topicOk, noteOk] = await Promise.all([
        ensureTopicOwnedByUser(input.topicId, ctx.userId),
        ensureNoteOwnedByUser(input.noteId, ctx.userId, input.kind),
      ]);
      if (!topicOk || !noteOk) throw new Error("Not found");

      const target =
        input.kind === "learning" ? curriculumTopicNotes : curriculumTopicGeneralNotes;
      await db
        .insert(target)
        .values({ topicId: input.topicId, noteId: input.noteId, source: "manual" })
        .onConflictDoNothing();

      return { ok: true };
    }),

  unlinkNote: protectedProcedure
    .input(z.object({ topicId: z.string(), noteId: z.string(), kind: kindSchema }))
    .mutation(async ({ ctx, input }) => {
      const owned = await ensureTopicOwnedByUser(input.topicId, ctx.userId);
      if (!owned) throw new Error("Topic not found");

      const target =
        input.kind === "learning" ? curriculumTopicNotes : curriculumTopicGeneralNotes;
      await db
        .delete(target)
        .where(
          and(
            eq(target.topicId, input.topicId),
            eq(target.noteId, input.noteId)
          )
        );
      return { ok: true };
    }),

  bulkUnlink: protectedProcedure
    .input(
      z.object({
        topicId: z.string(),
        items: z.array(
          z.object({ noteId: z.string(), kind: z.enum(["learning", "general"]) })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const owned = await ensureTopicOwnedByUser(input.topicId, ctx.userId);
      if (!owned) throw new Error("Topic not found");
      if (input.items.length === 0) return { removed: 0 };

      const learningIds = input.items.filter((i) => i.kind === "learning").map((i) => i.noteId);
      const generalIds = input.items.filter((i) => i.kind === "general").map((i) => i.noteId);

      let removed = 0;
      if (learningIds.length > 0) {
        const r = await db
          .delete(curriculumTopicNotes)
          .where(
            and(
              eq(curriculumTopicNotes.topicId, input.topicId),
              inArray(curriculumTopicNotes.noteId, learningIds)
            )
          );
        removed += learningIds.length;
        void r;
      }
      if (generalIds.length > 0) {
        await db
          .delete(curriculumTopicGeneralNotes)
          .where(
            and(
              eq(curriculumTopicGeneralNotes.topicId, input.topicId),
              inArray(curriculumTopicGeneralNotes.noteId, generalIds)
            )
          );
        removed += generalIds.length;
      }
      return { removed };
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
        .values({ topicId: input.topicId, noteId, source: "manual" })
        .onConflictDoNothing();

      return { noteId, learningTopicId };
    }),

  getTopicsForNote: protectedProcedure
    .input(z.object({ noteId: z.string(), kind: kindSchema }))
    .query(async ({ ctx, input }) => {
      const owned = await ensureNoteOwnedByUser(input.noteId, ctx.userId, input.kind);
      if (!owned) return [];

      const linkTable =
        input.kind === "learning" ? curriculumTopicNotes : curriculumTopicGeneralNotes;
      const rows = await db
        .select({
          id: curriculumTopics.id,
          title: curriculumTopics.title,
          areaTitle: curriculumAreas.title,
          trackTitle: curriculumTracks.title,
          mastery: curriculumTopics.mastery,
          source: linkTable.source,
        })
        .from(linkTable)
        .innerJoin(curriculumTopics, eq(curriculumTopics.id, linkTable.topicId))
        .innerJoin(curriculumAreas, eq(curriculumAreas.id, curriculumTopics.areaId))
        .innerJoin(curriculumTracks, eq(curriculumTracks.id, curriculumAreas.trackId))
        .where(
          and(eq(linkTable.noteId, input.noteId), eq(curriculumTracks.userId, ctx.userId))
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

  // For the side panel "Link existing note" picker. Returns user's recent
  // learning notes (general notes are linked via the note editor).
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
        .orderBy(desc(learningNotes.updatedAt))
        .limit(input.limit);
      return rows;
    }),

  // ── CRUD: tracks ───────────────────────────────────────────────
  createTrack: protectedProcedure
    .input(
      z.object({
        title: z.string().trim().min(1).max(80),
        icon: z.string().trim().max(8).optional(),
        description: z.string().trim().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const max = await db
        .select({ m: sql<number>`coalesce(max(${curriculumTracks.orderIndex}), -1)` })
        .from(curriculumTracks)
        .where(eq(curriculumTracks.userId, ctx.userId));
      const nextOrder = (max[0]?.m ?? -1) + 1;
      const id = crypto.randomUUID();
      await db.insert(curriculumTracks).values({
        id,
        userId: ctx.userId,
        title: input.title,
        icon: input.icon ?? "📚",
        description: input.description,
        orderIndex: nextOrder,
      });
      return { id };
    }),

  updateTrack: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().trim().min(1).max(80).optional(),
        icon: z.string().trim().max(8).optional(),
        description: z.string().trim().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const owned = await db
        .select({ id: curriculumTracks.id })
        .from(curriculumTracks)
        .where(and(eq(curriculumTracks.id, input.id), eq(curriculumTracks.userId, ctx.userId)))
        .limit(1);
      if (owned.length === 0) throw new Error("Track not found");

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (input.title !== undefined) patch.title = input.title;
      if (input.icon !== undefined) patch.icon = input.icon;
      if (input.description !== undefined) patch.description = input.description;

      await db.update(curriculumTracks).set(patch).where(eq(curriculumTracks.id, input.id));
      return { ok: true };
    }),

  deleteTrack: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(curriculumTracks)
        .where(and(eq(curriculumTracks.id, input.id), eq(curriculumTracks.userId, ctx.userId)));
      return { ok: true };
    }),

  // ── CRUD: areas ────────────────────────────────────────────────
  createArea: protectedProcedure
    .input(
      z.object({
        trackId: z.string(),
        title: z.string().trim().min(1).max(80),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const trackOk = await db
        .select({ id: curriculumTracks.id })
        .from(curriculumTracks)
        .where(and(eq(curriculumTracks.id, input.trackId), eq(curriculumTracks.userId, ctx.userId)))
        .limit(1);
      if (trackOk.length === 0) throw new Error("Track not found");

      const max = await db
        .select({ m: sql<number>`coalesce(max(${curriculumAreas.orderIndex}), -1)` })
        .from(curriculumAreas)
        .where(eq(curriculumAreas.trackId, input.trackId));
      const id = crypto.randomUUID();
      await db.insert(curriculumAreas).values({
        id,
        trackId: input.trackId,
        title: input.title,
        orderIndex: (max[0]?.m ?? -1) + 1,
      });
      return { id };
    }),

  updateArea: protectedProcedure
    .input(z.object({ id: z.string(), title: z.string().trim().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const ownerOk = await db
        .select({ id: curriculumAreas.id })
        .from(curriculumAreas)
        .innerJoin(curriculumTracks, eq(curriculumTracks.id, curriculumAreas.trackId))
        .where(and(eq(curriculumAreas.id, input.id), eq(curriculumTracks.userId, ctx.userId)))
        .limit(1);
      if (ownerOk.length === 0) throw new Error("Area not found");

      await db
        .update(curriculumAreas)
        .set({ title: input.title, updatedAt: new Date() })
        .where(eq(curriculumAreas.id, input.id));
      return { ok: true };
    }),

  deleteArea: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ownerOk = await db
        .select({ id: curriculumAreas.id })
        .from(curriculumAreas)
        .innerJoin(curriculumTracks, eq(curriculumTracks.id, curriculumAreas.trackId))
        .where(and(eq(curriculumAreas.id, input.id), eq(curriculumTracks.userId, ctx.userId)))
        .limit(1);
      if (ownerOk.length === 0) throw new Error("Area not found");

      await db.delete(curriculumAreas).where(eq(curriculumAreas.id, input.id));
      return { ok: true };
    }),

  // ── CRUD: topics ──────────────────────────────────────────────
  createTopic: protectedProcedure
    .input(
      z.object({
        areaId: z.string(),
        title: z.string().trim().min(1).max(120),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const ownerOk = await db
        .select({ id: curriculumAreas.id })
        .from(curriculumAreas)
        .innerJoin(curriculumTracks, eq(curriculumTracks.id, curriculumAreas.trackId))
        .where(and(eq(curriculumAreas.id, input.areaId), eq(curriculumTracks.userId, ctx.userId)))
        .limit(1);
      if (ownerOk.length === 0) throw new Error("Area not found");

      const max = await db
        .select({ m: sql<number>`coalesce(max(${curriculumTopics.orderIndex}), -1)` })
        .from(curriculumTopics)
        .where(eq(curriculumTopics.areaId, input.areaId));
      const id = crypto.randomUUID();
      await db.insert(curriculumTopics).values({
        id,
        areaId: input.areaId,
        title: input.title,
        orderIndex: (max[0]?.m ?? -1) + 1,
      });
      return { id };
    }),

  updateTopic: protectedProcedure
    .input(z.object({ id: z.string(), title: z.string().trim().min(1).max(120) }))
    .mutation(async ({ ctx, input }) => {
      const owned = await ensureTopicOwnedByUser(input.id, ctx.userId);
      if (!owned) throw new Error("Topic not found");

      await db
        .update(curriculumTopics)
        .set({ title: input.title, updatedAt: new Date() })
        .where(eq(curriculumTopics.id, input.id));
      return { ok: true };
    }),

  deleteTopic: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const owned = await ensureTopicOwnedByUser(input.id, ctx.userId);
      if (!owned) throw new Error("Topic not found");

      await db.delete(curriculumTopics).where(eq(curriculumTopics.id, input.id));
      return { ok: true };
    }),

  generateDescription: protectedProcedure
    .input(z.object({ topicId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const owned = await ensureTopicOwnedByUser(input.topicId, ctx.userId);
      if (!owned) throw new Error("Topic not found");

      const ctxRows = await db
        .select({
          topicTitle: curriculumTopics.title,
          areaTitle: curriculumAreas.title,
          trackTitle: curriculumTracks.title,
        })
        .from(curriculumTopics)
        .innerJoin(curriculumAreas, eq(curriculumAreas.id, curriculumTopics.areaId))
        .innerJoin(curriculumTracks, eq(curriculumTracks.id, curriculumAreas.trackId))
        .where(eq(curriculumTopics.id, input.topicId))
        .limit(1);
      const row = ctxRows[0];
      if (!row) throw new Error("Topic not found");

      const output = await generateStructuredData(
        {
          schema: z.object({
            description: z.string().min(20),
          }),
          name: "curriculum_topic_description",
          description: "A concise English description of a curriculum topic.",
          prompt: `Write a concise (60-100 words) English description for the curriculum topic below. Focus on:
- what the topic is, and why it matters
- the 1-2 most important sub-concepts a senior engineer should know
- one common pitfall or production gotcha if applicable
Do NOT use marketing language, do NOT repeat the title back, do NOT add headings or bullet points (plain prose only).

Track: ${row.trackTitle}
Area: ${row.areaTitle}
Topic: ${row.topicTitle}`,
        },
        { userId: ctx.userId },
      );

      const description = output.description.trim();
      await db
        .update(curriculumTopics)
        .set({ description, updatedAt: new Date() })
        .where(eq(curriculumTopics.id, input.topicId));

      return { description };
    }),

  setTopicDescription: protectedProcedure
    .input(z.object({ topicId: z.string(), description: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const owned = await ensureTopicOwnedByUser(input.topicId, ctx.userId);
      if (!owned) throw new Error("Topic not found");
      await db
        .update(curriculumTopics)
        .set({ description: input.description, updatedAt: new Date() })
        .where(eq(curriculumTopics.id, input.topicId));
      return { ok: true };
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
