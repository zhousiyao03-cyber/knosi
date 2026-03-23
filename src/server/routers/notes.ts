import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { notes } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod/v4";
import crypto from "crypto";
import {
  removeKnowledgeSourceIndex,
  syncNoteKnowledgeIndex,
} from "../ai/indexer";

export const notesRouter = router({
  list: publicProcedure.query(async () => {
    return db.select().from(notes).orderBy(desc(notes.updatedAt));
  }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const result = await db.select().from(notes).where(eq(notes.id, input.id));
      return result[0] ?? null;
    }),

  create: publicProcedure
    .input(
      z.object({
        title: z.string(),
        content: z.string().optional(),
        plainText: z.string().optional(),
        type: z.enum(["note", "journal", "summary"]).default("note"),
        tags: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const id = crypto.randomUUID();
      await db.insert(notes).values({ id, ...input });
      const [createdNote] = await db.select().from(notes).where(eq(notes.id, id));
      if (createdNote) {
        void syncNoteKnowledgeIndex(createdNote, "note-create").catch(
          () => undefined
        );
      }
      return { id };
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
        plainText: z.string().optional(),
        type: z.enum(["note", "journal", "summary"]).optional(),
        tags: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db
        .update(notes)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(notes.id, id));

      const [updatedNote] = await db.select().from(notes).where(eq(notes.id, id));
      if (updatedNote) {
        void syncNoteKnowledgeIndex(updatedNote, "note-update").catch(
          () => undefined
        );
      }

      return { id };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.delete(notes).where(eq(notes.id, input.id));
      void removeKnowledgeSourceIndex("note", input.id).catch(() => undefined);
      return { success: true };
    }),
});
