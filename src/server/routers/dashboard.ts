import { z } from "zod/v4";
import { router, publicProcedure } from "../trpc";
import { db } from "../db";
import { notes, bookmarks, todos, learningPaths } from "../db/schema";
import { eq, desc, count, like, or } from "drizzle-orm";

export const dashboardRouter = router({
  stats: publicProcedure.query(async () => {
    const [noteCount] = await db.select({ count: count() }).from(notes);
    const [bookmarkCount] = await db.select({ count: count() }).from(bookmarks);
    const [todoCount] = await db.select({ count: count() }).from(todos);
    const [doneCount] = await db
      .select({ count: count() })
      .from(todos)
      .where(eq(todos.status, "done"));
    const [pathCount] = await db.select({ count: count() }).from(learningPaths);

    const recentNotes = await db
      .select({ id: notes.id, title: notes.title, updatedAt: notes.updatedAt })
      .from(notes)
      .orderBy(desc(notes.updatedAt))
      .limit(5);

    const recentBookmarks = await db
      .select({
        id: bookmarks.id,
        title: bookmarks.title,
        url: bookmarks.url,
        createdAt: bookmarks.createdAt,
      })
      .from(bookmarks)
      .orderBy(desc(bookmarks.createdAt))
      .limit(5);

    const pendingTodos = await db
      .select({ id: todos.id, title: todos.title, priority: todos.priority })
      .from(todos)
      .where(eq(todos.status, "todo"))
      .orderBy(desc(todos.createdAt))
      .limit(5);

    return {
      counts: {
        notes: noteCount.count,
        bookmarks: bookmarkCount.count,
        todos: todoCount.count,
        todosDone: doneCount.count,
        learningPaths: pathCount.count,
      },
      recentNotes,
      recentBookmarks,
      pendingTodos,
    };
  }),

  search: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      const q = `%${input.query}%`;

      const noteResults = await db
        .select({ id: notes.id, title: notes.title })
        .from(notes)
        .where(or(like(notes.title, q), like(notes.plainText, q)))
        .limit(5);

      const bookmarkResults = await db
        .select({ id: bookmarks.id, title: bookmarks.title, url: bookmarks.url })
        .from(bookmarks)
        .where(or(like(bookmarks.title, q), like(bookmarks.url, q)))
        .limit(5);

      const todoResults = await db
        .select({ id: todos.id, title: todos.title })
        .from(todos)
        .where(like(todos.title, q))
        .limit(5);

      return {
        notes: noteResults.map((n) => ({ ...n, type: "note" as const })),
        bookmarks: bookmarkResults.map((b) => ({ ...b, type: "bookmark" as const })),
        todos: todoResults.map((t) => ({ ...t, type: "todo" as const })),
      };
    }),
});
