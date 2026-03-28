import { router, protectedProcedure } from "../trpc";
import { db } from "../db";
import { todos } from "../db/schema";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod/v4";
import crypto from "crypto";

export const todosRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.select().from(todos).where(eq(todos.userId, ctx.userId)).orderBy(desc(todos.createdAt));
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        description: z.string().nullable().optional(),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
        category: z.string().nullable().optional(),
        dueDate: z.coerce.date().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const id = crypto.randomUUID();
      await db.insert(todos).values({ id, userId: ctx.userId, ...input });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        description: z.string().nullable().optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        status: z.enum(["todo", "in_progress", "done"]).optional(),
        category: z.string().nullable().optional(),
        dueDate: z.union([z.null(), z.coerce.date()]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db
        .update(todos)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(todos.id, id), eq(todos.userId, ctx.userId)));
      return { id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await db.delete(todos).where(and(eq(todos.id, input.id), eq(todos.userId, ctx.userId)));
      return { success: true };
    }),
});
