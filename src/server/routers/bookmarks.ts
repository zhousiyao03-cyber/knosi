import { router, protectedProcedure } from "../trpc";
import { db } from "../db";
import { bookmarks } from "../db/schema";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod/v4";
import crypto from "crypto";
import { fetchContent } from "../ai/fetch-content";
import {
  removeKnowledgeSourceIndex,
  syncBookmarkKnowledgeIndex,
} from "../ai/indexer";

export const bookmarksRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(bookmarks).where(eq(bookmarks.userId, ctx.userId)).orderBy(desc(bookmarks.createdAt));
  }),

  create: protectedProcedure
    .input(
      z.object({
        url: z.string().optional(),
        title: z.string().optional(),
        content: z.string().optional(),
        tags: z.string().optional(),
        source: z.enum(["url", "text", "lark"]).default("url"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const id = crypto.randomUUID();

      // Insert immediately with pending status
      await db.insert(bookmarks).values({
        id,
        userId: ctx.userId,
        ...input,
        status: input.source === "url" && input.url ? "pending" : "processed",
      });

      // Fetch URL content if source is url
      if (input.source === "url" && input.url) {
        const result = await fetchContent(input.url);

        if (result.success) {
          await db
            .update(bookmarks)
            .set({
              content: result.content,
              title: input.title || result.title || input.url,
              status: "processed",
              updatedAt: new Date(),
            })
            .where(eq(bookmarks.id, id));
        } else {
          await db
            .update(bookmarks)
            .set({ status: "failed", updatedAt: new Date() })
            .where(eq(bookmarks.id, id));
        }
      }

      const [bookmark] = await db
        .select()
        .from(bookmarks)
        .where(eq(bookmarks.id, id));
      if (bookmark) {
        void syncBookmarkKnowledgeIndex(bookmark, "bookmark-create").catch(
          () => undefined
        );
      }

      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        tags: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db
        .update(bookmarks)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, ctx.userId)));

      const [updatedBookmark] = await db
        .select()
        .from(bookmarks)
        .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, ctx.userId)));
      if (updatedBookmark) {
        void syncBookmarkKnowledgeIndex(updatedBookmark, "bookmark-update").catch(
          () => undefined
        );
      }

      return { success: true };
    }),

  refetch: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [bookmark] = await db
        .select()
        .from(bookmarks)
        .where(and(eq(bookmarks.id, input.id), eq(bookmarks.userId, ctx.userId)));

      if (!bookmark || !bookmark.url) {
        return { success: false };
      }

      const result = await fetchContent(bookmark.url);

      if (result.success) {
        await db
          .update(bookmarks)
          .set({
            content: result.content,
            title: bookmark.title || result.title || bookmark.url,
            status: "processed",
            updatedAt: new Date(),
          })
          .where(and(eq(bookmarks.id, input.id), eq(bookmarks.userId, ctx.userId)));
      } else {
        await db
          .update(bookmarks)
          .set({ status: "failed", updatedAt: new Date() })
          .where(and(eq(bookmarks.id, input.id), eq(bookmarks.userId, ctx.userId)));
      }

      const [updatedBookmark] = await db
        .select()
        .from(bookmarks)
        .where(and(eq(bookmarks.id, input.id), eq(bookmarks.userId, ctx.userId)));
      if (updatedBookmark) {
        void syncBookmarkKnowledgeIndex(updatedBookmark, "bookmark-refetch").catch(
          () => undefined
        );
        return { success: updatedBookmark.status === "processed" };
      }

      return { success: false };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await db.delete(bookmarks).where(and(eq(bookmarks.id, input.id), eq(bookmarks.userId, ctx.userId)));
      void removeKnowledgeSourceIndex("bookmark", input.id).catch(
        () => undefined
      );
      return { success: true };
    }),
});
