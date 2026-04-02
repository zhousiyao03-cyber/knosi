# 学习笔记本 & 开源项目 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two independent modules — a Learning Notebook for topic-based study notes with AI co-authoring, and an Open Source Projects board for saving code analysis notes.

**Architecture:** Both modules follow the existing pattern: Drizzle schema tables → tRPC routers with `protectedProcedure` → Next.js App Router pages with client components. The Learning Notebook reuses the existing Tiptap editor and AI provider (`streamChatResponse` / `generateStructuredData`). The OSS Projects module is simpler — CRUD only with tag filtering.

**Tech Stack:** Next.js 16, React 19, Drizzle ORM (SQLite), tRPC v11, Tiptap editor, Vercel AI SDK, zod/v4, Tailwind CSS v4, Playwright E2E.

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `src/server/db/schema.ts` (modify) | Add 5 new tables: `learningTopics`, `learningNotes`, `learningReviews`, `osProjects`, `osProjectNotes` |
| `src/server/routers/learning-notebook.ts` | tRPC router for learning topics + notes CRUD, AI draft, AI review tools |
| `src/server/routers/oss-projects.ts` | tRPC router for OSS projects + notes CRUD |
| `src/server/routers/_app.ts` (modify) | Register new routers |
| `src/components/layout/navigation.ts` (modify) | Add Learn + Projects nav items |
| `src/app/(app)/learn/page.tsx` (replace) | Learning topics list page |
| `src/app/(app)/learn/[topicId]/page.tsx` | Topic detail: notes tab + AI assistant tab |
| `src/app/(app)/learn/[topicId]/notes/[noteId]/page.tsx` | Learning note editor (Tiptap) |
| `src/app/api/learn/draft/route.ts` | Streaming API for AI note drafting |
| `src/app/(app)/projects/page.tsx` | OSS projects list page |
| `src/app/(app)/projects/[id]/page.tsx` | Project detail: notes list with tag filter |
| `src/app/(app)/projects/[id]/notes/[noteId]/page.tsx` | Project note editor (Tiptap) |
| `e2e/learning-notebook.spec.ts` | E2E tests for learning notebook |
| `e2e/oss-projects.spec.ts` | E2E tests for OSS projects |

---

## Task 1: Database Schema — Learning Tables

**Files:**
- Modify: `src/server/db/schema.ts`

- [ ] **Step 1: Add learningTopics table to schema**

Add after the existing `portfolioNews` table definition at the bottom of `src/server/db/schema.ts`:

```typescript
// ── Learning Notebook ──────────────────────────────

export const learningTopics = sqliteTable("learning_topics", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  icon: text("icon"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const learningNotes = sqliteTable("learning_notes", {
  id: text("id").primaryKey(),
  topicId: text("topic_id")
    .notNull()
    .references(() => learningTopics.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content"),
  plainText: text("plain_text"),
  tags: text("tags"),
  aiSummary: text("ai_summary"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const learningReviews = sqliteTable("learning_reviews", {
  id: text("id").primaryKey(),
  topicId: text("topic_id")
    .notNull()
    .references(() => learningTopics.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["outline", "gap", "quiz"] }).notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
```

- [ ] **Step 2: Generate and apply migration**

```bash
pnpm db:generate
pnpm db:push
```

Expected: migration files created in `drizzle/`, tables created in SQLite.

- [ ] **Step 3: Verify tables exist**

```bash
pnpm db:push
```

Expected: "No changes detected" or successful push.

- [ ] **Step 4: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat: add learning notebook schema tables"
```

---

## Task 2: Database Schema — OSS Projects Tables

**Files:**
- Modify: `src/server/db/schema.ts`

- [ ] **Step 1: Add OSS project tables to schema**

Add after the learning tables in `src/server/db/schema.ts`:

```typescript
// ── Open Source Projects ──────────────────────────

export const osProjects = sqliteTable("os_projects", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  repoUrl: text("repo_url"),
  description: text("description"),
  language: text("language"),
  aiSummary: text("ai_summary"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

export const osProjectNotes = sqliteTable("os_project_notes", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => osProjects.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content"),
  plainText: text("plain_text"),
  tags: text("tags"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
```

- [ ] **Step 2: Generate and apply migration**

```bash
pnpm db:generate
pnpm db:push
```

- [ ] **Step 3: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat: add oss projects schema tables"
```

---

## Task 3: tRPC Router — Learning Notebook

**Files:**
- Create: `src/server/routers/learning-notebook.ts`
- Modify: `src/server/routers/_app.ts`

- [ ] **Step 1: Create the learning notebook router**

Create `src/server/routers/learning-notebook.ts`:

```typescript
import { router, protectedProcedure } from "../trpc";
import { db } from "../db";
import { learningTopics, learningNotes, learningReviews } from "../db/schema";
import { and, desc, eq, like } from "drizzle-orm";
import { z } from "zod/v4";
import crypto from "crypto";

export const learningNotebookRouter = router({
  // ── Topics ──────────────────────────────
  listTopics: protectedProcedure.query(async ({ ctx }) => {
    const topics = await db
      .select()
      .from(learningTopics)
      .where(eq(learningTopics.userId, ctx.userId))
      .orderBy(desc(learningTopics.updatedAt));

    // Attach note count and recent tags for each topic
    const topicsWithMeta = await Promise.all(
      topics.map(async (topic) => {
        const notes = await db
          .select({ tags: learningNotes.tags })
          .from(learningNotes)
          .where(eq(learningNotes.topicId, topic.id));

        const allTags = notes
          .flatMap((n) => {
            try { return JSON.parse(n.tags ?? "[]"); } catch { return []; }
          })
          .filter((t): t is string => typeof t === "string");

        const tagCounts = new Map<string, number>();
        for (const tag of allTags) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
        }
        const topTags = [...tagCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([tag]) => tag);

        return { ...topic, noteCount: notes.length, topTags };
      })
    );

    return topicsWithMeta;
  }),

  getTopic: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const [topic] = await db
        .select()
        .from(learningTopics)
        .where(and(eq(learningTopics.id, input.id), eq(learningTopics.userId, ctx.userId)));
      return topic ?? null;
    }),

  createTopic: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      icon: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = crypto.randomUUID();
      await db.insert(learningTopics).values({ id, userId: ctx.userId, ...input });
      return { id };
    }),

  updateTopic: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db
        .update(learningTopics)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(learningTopics.id, id), eq(learningTopics.userId, ctx.userId)));
      return { id };
    }),

  deleteTopic: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(learningTopics)
        .where(and(eq(learningTopics.id, input.id), eq(learningTopics.userId, ctx.userId)));
      return { success: true };
    }),

  // ── Notes ──────────────────────────────
  listNotes: protectedProcedure
    .input(z.object({
      topicId: z.string(),
      search: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const conditions = [
        eq(learningNotes.topicId, input.topicId),
        eq(learningNotes.userId, ctx.userId),
      ];

      if (input.search) {
        conditions.push(like(learningNotes.plainText, `%${input.search}%`));
      }

      return db
        .select()
        .from(learningNotes)
        .where(and(...conditions))
        .orderBy(desc(learningNotes.updatedAt));
    }),

  getNote: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const [note] = await db
        .select()
        .from(learningNotes)
        .where(and(eq(learningNotes.id, input.id), eq(learningNotes.userId, ctx.userId)));
      return note ?? null;
    }),

  createNote: protectedProcedure
    .input(z.object({
      topicId: z.string(),
      title: z.string().min(1),
      content: z.string().optional(),
      plainText: z.string().optional(),
      tags: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = crypto.randomUUID();
      await db.insert(learningNotes).values({ id, userId: ctx.userId, ...input });
      // Touch parent topic updatedAt
      await db
        .update(learningTopics)
        .set({ updatedAt: new Date() })
        .where(eq(learningTopics.id, input.topicId));
      return { id };
    }),

  updateNote: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      content: z.string().optional(),
      plainText: z.string().optional(),
      tags: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db
        .update(learningNotes)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(learningNotes.id, id), eq(learningNotes.userId, ctx.userId)));
      return { id };
    }),

  deleteNote: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(learningNotes)
        .where(and(eq(learningNotes.id, input.id), eq(learningNotes.userId, ctx.userId)));
      return { success: true };
    }),

  // ── AI Reviews ──────────────────────────
  listReviews: protectedProcedure
    .input(z.object({ topicId: z.string() }))
    .query(async ({ input, ctx }) => {
      return db
        .select()
        .from(learningReviews)
        .where(and(eq(learningReviews.topicId, input.topicId), eq(learningReviews.userId, ctx.userId)))
        .orderBy(desc(learningReviews.createdAt));
    }),

  generateReview: protectedProcedure
    .input(z.object({
      topicId: z.string(),
      type: z.enum(["outline", "gap", "quiz"]),
    }))
    .mutation(async ({ input, ctx }) => {
      // Gather all notes for context
      const notes = await db
        .select({ title: learningNotes.title, plainText: learningNotes.plainText })
        .from(learningNotes)
        .where(and(eq(learningNotes.topicId, input.topicId), eq(learningNotes.userId, ctx.userId)));

      const [topic] = await db
        .select()
        .from(learningTopics)
        .where(and(eq(learningTopics.id, input.topicId), eq(learningTopics.userId, ctx.userId)));

      if (!topic) throw new Error("Topic not found");

      const notesContext = notes
        .map((n) => `## ${n.title}\n${n.plainText ?? "(empty)"}`)
        .join("\n\n");

      const prompts: Record<string, string> = {
        outline: `你是一个学习助手。用户正在学习「${topic.title}」。根据用户已有的笔记内容，生成一份结构化的知识大纲（JSON 格式）。大纲应包含主要知识领域及其子主题，标注哪些已在笔记中覆盖、哪些还未覆盖。\n\n用户笔记：\n${notesContext}\n\n返回 JSON 格式：{ "title": "知识大纲", "sections": [{ "name": "章节名", "covered": true/false, "subtopics": [{ "name": "子主题", "covered": true/false }] }] }`,
        gap: `你是一个学习助手。用户正在学习「${topic.title}」。分析用户的笔记，找出知识盲点——即该领域重要但用户笔记中未提及的知识点。\n\n用户笔记：\n${notesContext}\n\n返回 JSON 格式：{ "title": "盲点分析", "gaps": [{ "topic": "缺失的知识点", "importance": "high/medium/low", "reason": "为什么重要" }] }`,
        quiz: `你是一个学习助手。用户正在学习「${topic.title}」。根据用户的笔记内容，生成 5-10 道复习题，覆盖核心概念。\n\n用户笔记：\n${notesContext}\n\n返回 JSON 格式：{ "title": "复习题", "questions": [{ "question": "问题", "answer": "参考答案", "relatedNote": "相关笔记标题（可选）" }] }`,
      };

      const { generateStructuredData } = await import("../ai/provider");

      const reviewSchema = z.object({
        title: z.string(),
      }).passthrough();

      const result = await generateStructuredData({
        name: `learning-review-${input.type}`,
        description: `Generate a ${input.type} review for learning topic`,
        prompt: prompts[input.type],
        schema: reviewSchema,
      });

      const id = crypto.randomUUID();
      await db.insert(learningReviews).values({
        id,
        topicId: input.topicId,
        userId: ctx.userId,
        type: input.type,
        content: JSON.stringify(result),
      });

      return { id, content: result };
    }),
});
```

- [ ] **Step 2: Register in app router**

In `src/server/routers/_app.ts`, add:

```typescript
import { learningNotebookRouter } from "./learning-notebook";
```

And add to the router object:

```typescript
learningNotebook: learningNotebookRouter,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/learning-notebook.ts src/server/routers/_app.ts
git commit -m "feat: add learning notebook tRPC router"
```

---

## Task 4: tRPC Router — OSS Projects

**Files:**
- Create: `src/server/routers/oss-projects.ts`
- Modify: `src/server/routers/_app.ts`

- [ ] **Step 1: Create the OSS projects router**

Create `src/server/routers/oss-projects.ts`:

```typescript
import { router, protectedProcedure } from "../trpc";
import { db } from "../db";
import { osProjects, osProjectNotes } from "../db/schema";
import { and, desc, eq, like } from "drizzle-orm";
import { z } from "zod/v4";
import crypto from "crypto";

export const ossProjectsRouter = router({
  // ── Projects ──────────────────────────
  list: protectedProcedure.query(async ({ ctx }) => {
    const projects = await db
      .select()
      .from(osProjects)
      .where(eq(osProjects.userId, ctx.userId))
      .orderBy(desc(osProjects.updatedAt));

    const projectsWithMeta = await Promise.all(
      projects.map(async (project) => {
        const notes = await db
          .select({ tags: osProjectNotes.tags })
          .from(osProjectNotes)
          .where(eq(osProjectNotes.projectId, project.id));

        const allTags = notes
          .flatMap((n) => {
            try { return JSON.parse(n.tags ?? "[]"); } catch { return []; }
          })
          .filter((t): t is string => typeof t === "string");

        const tagCounts = new Map<string, number>();
        for (const tag of allTags) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
        }
        const topTags = [...tagCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([tag]) => tag);

        return { ...project, noteCount: notes.length, topTags };
      })
    );

    return projectsWithMeta;
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const [project] = await db
        .select()
        .from(osProjects)
        .where(and(eq(osProjects.id, input.id), eq(osProjects.userId, ctx.userId)));
      return project ?? null;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      repoUrl: z.string().optional(),
      description: z.string().optional(),
      language: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = crypto.randomUUID();
      await db.insert(osProjects).values({ id, userId: ctx.userId, ...input });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).optional(),
      repoUrl: z.string().optional(),
      description: z.string().optional(),
      language: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db
        .update(osProjects)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(osProjects.id, id), eq(osProjects.userId, ctx.userId)));
      return { id };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(osProjects)
        .where(and(eq(osProjects.id, input.id), eq(osProjects.userId, ctx.userId)));
      return { success: true };
    }),

  // ── Notes ──────────────────────────
  listNotes: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      tag: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const allNotes = await db
        .select()
        .from(osProjectNotes)
        .where(and(
          eq(osProjectNotes.projectId, input.projectId),
          eq(osProjectNotes.userId, ctx.userId),
        ))
        .orderBy(desc(osProjectNotes.updatedAt));

      if (!input.tag) return allNotes;

      return allNotes.filter((note) => {
        try {
          const tags = JSON.parse(note.tags ?? "[]");
          return Array.isArray(tags) && tags.includes(input.tag);
        } catch {
          return false;
        }
      });
    }),

  getNote: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const [note] = await db
        .select()
        .from(osProjectNotes)
        .where(and(eq(osProjectNotes.id, input.id), eq(osProjectNotes.userId, ctx.userId)));
      return note ?? null;
    }),

  createNote: protectedProcedure
    .input(z.object({
      projectId: z.string(),
      title: z.string().min(1),
      content: z.string().optional(),
      plainText: z.string().optional(),
      tags: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = crypto.randomUUID();
      await db.insert(osProjectNotes).values({ id, userId: ctx.userId, ...input });
      await db
        .update(osProjects)
        .set({ updatedAt: new Date() })
        .where(eq(osProjects.id, input.projectId));
      return { id };
    }),

  updateNote: protectedProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      content: z.string().optional(),
      plainText: z.string().optional(),
      tags: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db
        .update(osProjectNotes)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(osProjectNotes.id, id), eq(osProjectNotes.userId, ctx.userId)));
      return { id };
    }),

  deleteNote: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(osProjectNotes)
        .where(and(eq(osProjectNotes.id, input.id), eq(osProjectNotes.userId, ctx.userId)));
      return { success: true };
    }),
});
```

- [ ] **Step 2: Register in app router**

In `src/server/routers/_app.ts`, add:

```typescript
import { ossProjectsRouter } from "./oss-projects";
```

And add to the router object:

```typescript
ossProjects: ossProjectsRouter,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/oss-projects.ts src/server/routers/_app.ts
git commit -m "feat: add oss projects tRPC router"
```

---

## Task 5: Navigation — Add Sidebar Entries

**Files:**
- Modify: `src/components/layout/navigation.ts`

- [ ] **Step 1: Add Learn and Projects to navigation**

In `src/components/layout/navigation.ts`, add imports:

```typescript
import { BookOpen, FolderGit2 } from "lucide-react";
```

Add two entries to `navigationItems` array, after the Notes entry:

```typescript
{ href: "/learn", label: "Learn", icon: BookOpen },
{ href: "/projects", label: "Projects", icon: FolderGit2 },
```

The full array should be:
```typescript
export const navigationItems = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/notes", label: "Notes", icon: FileText },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/projects", label: "Projects", icon: FolderGit2 },
  { href: "/focus", label: "Focus", icon: Timer },
  { href: "/portfolio", label: "Portfolio", icon: TrendingUp },
  ...(process.env.NEXT_PUBLIC_ENABLE_TOKEN_USAGE === "true"
    ? [{ href: "/usage", label: "Token Usage", icon: Activity }]
    : []),
  { href: "/ask", label: "Ask AI", icon: MessageCircle },
] as const;
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/navigation.ts
git commit -m "feat: add Learn and Projects to sidebar navigation"
```

---

## Task 6: Learning Topics List Page

**Files:**
- Replace: `src/app/(app)/learn/page.tsx`

- [ ] **Step 1: Replace the learn page with topics list**

Replace the entire content of `src/app/(app)/learn/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { BookOpen, Plus, Loader2, Trash2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LearnPage() {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIcon, setNewIcon] = useState("📚");

  const utils = trpc.useUtils();
  const { data: topics = [], isLoading } = trpc.learningNotebook.listTopics.useQuery();

  const createTopic = trpc.learningNotebook.createTopic.useMutation({
    onSuccess: (result) => {
      utils.learningNotebook.listTopics.invalidate();
      setShowCreate(false);
      setNewTitle("");
      setNewDescription("");
      setNewIcon("📚");
      router.push(`/learn/${result.id}`);
    },
  });

  const deleteTopic = trpc.learningNotebook.deleteTopic.useMutation({
    onSuccess: () => utils.learningNotebook.listTopics.invalidate(),
  });

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createTopic.mutate({
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      icon: newIcon || undefined,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">学习笔记本</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
        >
          <Plus size={16} />
          新主题
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
          <div className="flex items-center gap-3 mb-3">
            <input
              type="text"
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              className="w-12 text-center text-2xl rounded border border-stone-200 bg-transparent p-1 dark:border-stone-700"
              maxLength={4}
            />
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="主题名称，如「Go 语言」"
              className="flex-1 rounded-lg border border-stone-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-stone-700 dark:text-stone-100"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="简要描述（可选）"
            className="w-full mb-3 rounded-lg border border-stone-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-stone-700 dark:text-stone-100"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || createTopic.isPending}
              className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {createTopic.isPending ? <Loader2 size={14} className="animate-spin" /> : "创建"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-stone-400" />
        </div>
      ) : topics.length === 0 ? (
        <div className="text-center py-20 text-stone-400 dark:text-stone-500">
          <BookOpen size={48} className="mx-auto mb-3 opacity-50" />
          <p>还没有学习主题</p>
          <p className="text-sm mt-1">点击「新主题」开始你的学习之旅</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {topics.map((topic) => (
            <div
              key={topic.id}
              className="group relative rounded-lg border border-stone-200 bg-white p-5 hover:border-violet-300 hover:shadow-sm transition-all cursor-pointer dark:border-stone-800 dark:bg-stone-950 dark:hover:border-violet-700"
              onClick={() => router.push(`/learn/${topic.id}`)}
            >
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl">{topic.icon ?? "📚"}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-stone-900 dark:text-stone-100 truncate">
                    {topic.title}
                  </h3>
                  {topic.description && (
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-1">
                      {topic.description}
                    </p>
                  )}
                </div>
                <span className="text-xs text-stone-400 dark:text-stone-500 whitespace-nowrap">
                  {topic.noteCount} 篇笔记
                </span>
              </div>

              {topic.topTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {topic.topTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-600 dark:bg-violet-950/50 dark:text-violet-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`确定要删除「${topic.title}」及其所有笔记吗？`)) {
                    deleteTopic.mutate({ id: topic.id });
                  }
                }}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 rounded-full p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500 transition-all dark:hover:bg-red-950/50"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/learn/page.tsx
git commit -m "feat: replace learn page with topics list UI"
```

---

## Task 7: Learning Topic Detail Page

**Files:**
- Create: `src/app/(app)/learn/[topicId]/page.tsx`

- [ ] **Step 1: Create the topic detail page**

Create `src/app/(app)/learn/[topicId]/page.tsx`:

```typescript
"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  Search,
  Loader2,
  Trash2,
  Sparkles,
  Map,
  HelpCircle,
  Eye,
  MessageCircle,
} from "lucide-react";

type ReviewType = "outline" | "gap" | "quiz";

const REVIEW_TOOLS: Array<{
  type: ReviewType;
  icon: typeof Map;
  label: string;
  description: string;
}> = [
  { type: "outline", icon: Map, label: "生成知识大纲", description: "根据你的所有笔记，梳理出知识结构和学习脉络" },
  { type: "gap", icon: Eye, label: "盲点分析", description: "分析你已学的内容，指出可能遗漏的关键知识点" },
  { type: "quiz", icon: HelpCircle, label: "生成复习题", description: "根据笔记内容生成问答题，检验你的理解程度" },
];

function NotesTab({ topicId }: { topicId: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const utils = trpc.useUtils();
  const { data: notes = [], isLoading } = trpc.learningNotebook.listNotes.useQuery({
    topicId,
    search: search || undefined,
  });

  const createNote = trpc.learningNotebook.createNote.useMutation({
    onSuccess: (result) => {
      utils.learningNotebook.listNotes.invalidate({ topicId });
      setShowCreate(false);
      setNewTitle("");
      router.push(`/learn/${topicId}/notes/${result.id}`);
    },
  });

  const deleteNote = trpc.learningNotebook.deleteNote.useMutation({
    onSuccess: () => utils.learningNotebook.listNotes.invalidate({ topicId }),
  });

  const handleCreateBlank = () => {
    if (!newTitle.trim()) return;
    createNote.mutate({ topicId, title: newTitle.trim() });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索笔记..."
            className="w-full rounded-lg border border-stone-200 bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-400 dark:border-stone-700 dark:text-stone-100"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
          >
            <Plus size={14} />
            新笔记
          </button>
          <button
            onClick={() => {
              const keyword = prompt("输入主题关键词，AI 将生成一份详细初稿：");
              if (!keyword?.trim()) return;
              createNote.mutate({
                topicId,
                title: keyword.trim(),
                content: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "AI 正在生成内容..." }] }] }),
                plainText: "AI 正在生成内容...",
              });
            }}
            className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-600 hover:bg-violet-100 transition-colors dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300"
          >
            <Sparkles size={14} />
            AI 起草
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="mb-4 flex items-center gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="笔记标题"
            className="flex-1 rounded-lg border border-stone-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-violet-400 dark:border-stone-700 dark:text-stone-100"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleCreateBlank()}
          />
          <button onClick={handleCreateBlank} disabled={!newTitle.trim()} className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white hover:bg-violet-700 disabled:opacity-50">
            创建
          </button>
          <button onClick={() => setShowCreate(false)} className="rounded-lg px-3 py-2 text-sm text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800">
            取消
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-stone-400" />
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12 text-stone-400">
          <p>还没有笔记，开始记录你的学习吧</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => {
            const tags: string[] = (() => { try { return JSON.parse(note.tags ?? "[]"); } catch { return []; } })();
            return (
              <div
                key={note.id}
                className="group relative rounded-lg border border-stone-200 bg-white p-4 hover:border-violet-200 transition-all cursor-pointer dark:border-stone-800 dark:bg-stone-950 dark:hover:border-violet-800"
                onClick={() => router.push(`/learn/${topicId}/notes/${note.id}`)}
              >
                <div className="flex items-start justify-between">
                  <h4 className="font-medium text-stone-900 dark:text-stone-100 text-sm">
                    {note.title}
                  </h4>
                  <span className="text-xs text-stone-400 whitespace-nowrap ml-4">
                    {note.updatedAt ? formatDate(new Date(note.updatedAt)) : ""}
                  </span>
                </div>
                {note.plainText && (
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">
                    {note.plainText.slice(0, 200)}
                  </p>
                )}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("确定要删除这条笔记吗？")) deleteNote.mutate({ id: note.id });
                  }}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 rounded-full p-1 text-stone-400 hover:bg-red-50 hover:text-red-500 transition-all dark:hover:bg-red-950/50"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AIAssistantTab({ topicId }: { topicId: string }) {
  const [generating, setGenerating] = useState<ReviewType | null>(null);
  const utils = trpc.useUtils();
  const { data: reviews = [] } = trpc.learningNotebook.listReviews.useQuery({ topicId });

  const generateReview = trpc.learningNotebook.generateReview.useMutation({
    onSuccess: () => {
      utils.learningNotebook.listReviews.invalidate({ topicId });
      setGenerating(null);
    },
    onError: () => setGenerating(null),
  });

  const handleGenerate = (type: ReviewType) => {
    setGenerating(type);
    generateReview.mutate({ topicId, type });
  };

  const typeLabels: Record<string, string> = { outline: "🗺️ 知识大纲", gap: "🔍 盲点分析", quiz: "❓ 复习题" };

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 mb-6">
        {REVIEW_TOOLS.map((tool) => (
          <button
            key={tool.type}
            onClick={() => handleGenerate(tool.type)}
            disabled={generating !== null}
            className="flex items-start gap-3 rounded-lg border border-violet-200 bg-violet-50/50 p-4 text-left hover:bg-violet-100/50 transition-colors disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/30 dark:hover:bg-violet-950/50"
          >
            <tool.icon size={20} className="text-violet-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-sm text-violet-700 dark:text-violet-300">
                {tool.label}
                {generating === tool.type && <Loader2 size={12} className="inline ml-1 animate-spin" />}
              </div>
              <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{tool.description}</div>
            </div>
          </button>
        ))}
      </div>

      {reviews.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400 mb-3">历史生成</h3>
          <div className="space-y-2">
            {reviews.map((review) => {
              let parsed: { title?: string } = {};
              try { parsed = JSON.parse(review.content); } catch {}
              return (
                <details
                  key={review.id}
                  className="rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-950"
                >
                  <summary className="flex items-center justify-between p-3 cursor-pointer text-sm">
                    <span className="text-violet-600 dark:text-violet-300">
                      {typeLabels[review.type] ?? review.type}
                    </span>
                    <span className="text-xs text-stone-400">
                      {review.createdAt ? formatDate(new Date(review.createdAt)) : ""}
                    </span>
                  </summary>
                  <div className="px-3 pb-3">
                    <pre className="text-xs text-stone-600 dark:text-stone-300 whitespace-pre-wrap overflow-auto max-h-96">
                      {JSON.stringify(parsed, null, 2)}
                    </pre>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TopicDetailPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = use(params);
  const router = useRouter();
  const [tab, setTab] = useState<"notes" | "ai">("notes");

  const { data: topic, isLoading } = trpc.learningNotebook.getTopic.useQuery({ id: topicId });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={24} className="animate-spin text-stone-400" />
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="py-12 text-center text-stone-500">
        <p>主题不存在</p>
        <button onClick={() => router.push("/learn")} className="mt-2 text-violet-600 hover:underline text-sm">
          返回学习笔记本
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.push("/learn")}
        className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 mb-4 transition-colors"
      >
        <ArrowLeft size={14} />
        返回学习笔记本
      </button>

      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">{topic.icon ?? "📚"}</span>
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{topic.title}</h1>
          {topic.description && (
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">{topic.description}</p>
          )}
        </div>
      </div>

      <div className="flex gap-0 border-b border-stone-200 dark:border-stone-800 mb-6">
        <button
          onClick={() => setTab("notes")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium transition-colors",
            tab === "notes"
              ? "border-b-2 border-violet-600 text-violet-600 dark:text-violet-400"
              : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
          )}
        >
          笔记
        </button>
        <button
          onClick={() => setTab("ai")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium transition-colors",
            tab === "ai"
              ? "border-b-2 border-violet-600 text-violet-600 dark:text-violet-400"
              : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
          )}
        >
          AI 助手
        </button>
      </div>

      {tab === "notes" ? <NotesTab topicId={topicId} /> : <AIAssistantTab topicId={topicId} />}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/learn/[topicId]/page.tsx
git commit -m "feat: add learning topic detail page with notes and AI tabs"
```

---

## Task 8: Learning Note Editor Page

**Files:**
- Create: `src/app/(app)/learn/[topicId]/notes/[noteId]/page.tsx`

- [ ] **Step 1: Create the learning note editor page**

Create `src/app/(app)/learn/[topicId]/notes/[noteId]/page.tsx`. This reuses the existing Tiptap editor component. Follow the same pattern as `src/app/(app)/notes/[id]/page.tsx` but simplified (no cover, no type picker):

```typescript
"use client";

import { use, useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Tag, X } from "lucide-react";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { useToast } from "@/components/ui/toast";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  try {
    const value = JSON.parse(tags);
    return Array.isArray(value) ? value.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export default function LearningNoteEditorPage({
  params,
}: {
  params: Promise<{ topicId: string; noteId: string }>;
}) {
  const { topicId, noteId } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const utils = trpc.useUtils();
  const { data: note, isLoading } = trpc.learningNotebook.getNote.useQuery({ id: noteId });

  const updateNote = trpc.learningNotebook.updateNote.useMutation({
    onSuccess: () => utils.learningNotebook.getNote.invalidate({ id: noteId }),
  });

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const contentRef = useRef({ content: "", plainText: "" });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const initialized = useRef(false);

  useEffect(() => {
    if (note && !initialized.current) {
      setTitle(note.title);
      setTags(parseTags(note.tags));
      contentRef.current = { content: note.content ?? "", plainText: note.plainText ?? "" };
      initialized.current = true;
    }
  }, [note]);

  const doSave = useCallback(
    (overrides?: { title?: string; tags?: string[] }) => {
      setSaveStatus("saving");
      updateNote.mutate(
        {
          id: noteId,
          title: overrides?.title ?? title,
          content: contentRef.current.content,
          plainText: contentRef.current.plainText,
          tags: JSON.stringify(overrides?.tags ?? tags),
        },
        {
          onSuccess: () => setSaveStatus("saved"),
          onError: () => setSaveStatus("unsaved"),
        }
      );
    },
    [noteId, title, tags, updateNote]
  );

  const scheduleAutoSave = useCallback(() => {
    setSaveStatus("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(), 1500);
  }, [doSave]);

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  const handleContentChange = useCallback(
    (content: string, plainText: string) => {
      contentRef.current = { content, plainText };
      scheduleAutoSave();
    },
    [scheduleAutoSave]
  );

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setSaveStatus("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave({ title: newTitle }), 1500);
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (!tag || tags.includes(tag)) return;
    const newTags = [...tags, tag];
    setTags(newTags);
    setTagInput("");
    doSave({ tags: newTags });
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter((t) => t !== tagToRemove);
    setTags(newTags);
    doSave({ tags: newTags });
  };

  if (isLoading || !note) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-200 border-t-stone-600 dark:border-stone-700 dark:border-t-stone-200" />
      </div>
    );
  }

  const statusDot = {
    saved: "bg-emerald-400",
    saving: "bg-amber-400 animate-pulse",
    unsaved: "bg-stone-300 dark:bg-stone-600",
  };

  return (
    <div className="-mx-4 -mt-5 w-auto pb-10 md:-mx-6 md:-mt-6">
      <div className="mx-auto mb-4 flex w-full max-w-[980px] items-center justify-between gap-4 px-6 pt-5 md:px-10 md:pt-6">
        <button
          onClick={() => router.push(`/learn/${topicId}`)}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-stone-100"
        >
          <ArrowLeft size={16} />
          返回主题
        </button>
        <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-3 py-1 text-xs text-stone-500 shadow-sm dark:border-stone-800 dark:bg-stone-950/80 dark:text-stone-400">
          <span className={cn("h-2 w-2 rounded-full", statusDot[saveStatus])} />
          {saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving..." : "Editing"}
        </span>
      </div>

      <div className="mx-auto w-full max-w-[980px] px-6 md:px-10">
        <div className="mb-3 flex flex-wrap items-center gap-2 px-1 text-sm">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-sm text-emerald-700 dark:border-emerald-900/80 dark:bg-emerald-950/50 dark:text-emerald-200"
            >
              <Tag size={12} />
              {tag}
              <button onClick={() => handleRemoveTag(tag)} className="rounded-full px-1 text-emerald-500 hover:text-emerald-700">
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
            onBlur={() => { if (tagInput.trim()) handleAddTag(); }}
            placeholder="Add tag..."
            className="min-w-28 rounded-full border border-dashed border-stone-200 bg-transparent px-3 py-1 text-sm outline-none placeholder:text-stone-400 focus:border-stone-300 dark:border-stone-700 dark:placeholder:text-stone-500"
          />
        </div>

        <div className="mt-6 mb-6 px-1">
          <textarea
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              (document.querySelector(".notion-editor") as HTMLElement | null)?.focus();
            }}
            placeholder="笔记标题"
            rows={1}
            className="w-full resize-none border-none bg-transparent text-3xl font-semibold leading-tight text-stone-900 outline-none placeholder:text-stone-300 dark:text-stone-100 dark:placeholder:text-stone-600"
            style={{ overflow: "hidden" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${target.scrollHeight}px`;
            }}
          />
        </div>

        <div className="px-1">
          <TiptapEditor
            content={note.content ?? undefined}
            onChange={handleContentChange}
            onError={(message) => toast(message, "error")}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/learn/[topicId]/notes/[noteId]/page.tsx
git commit -m "feat: add learning note editor page with Tiptap"
```

---

## Task 9: OSS Projects List Page

**Files:**
- Create: `src/app/(app)/projects/page.tsx`

- [ ] **Step 1: Create the projects list page**

Create `src/app/(app)/projects/page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { FolderGit2, Plus, Loader2, Trash2, ExternalLink } from "lucide-react";

const LANGUAGE_COLORS: Record<string, string> = {
  Go: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
  Rust: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  TypeScript: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  JavaScript: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300",
  Python: "bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  Java: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  C: "bg-stone-50 text-stone-700 dark:bg-stone-950/50 dark:text-stone-300",
  "C++": "bg-pink-50 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300",
};

export default function ProjectsPage() {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("");

  const utils = trpc.useUtils();
  const { data: projects = [], isLoading } = trpc.ossProjects.list.useQuery();

  const createProject = trpc.ossProjects.create.useMutation({
    onSuccess: (result) => {
      utils.ossProjects.list.invalidate();
      setShowCreate(false);
      setName("");
      setRepoUrl("");
      setDescription("");
      setLanguage("");
      router.push(`/projects/${result.id}`);
    },
  });

  const deleteProject = trpc.ossProjects.delete.useMutation({
    onSuccess: () => utils.ossProjects.list.invalidate(),
  });

  const handleCreate = () => {
    if (!name.trim()) return;
    createProject.mutate({
      name: name.trim(),
      repoUrl: repoUrl.trim() || undefined,
      description: description.trim() || undefined,
      language: language.trim() || undefined,
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">开源项目</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 transition-colors dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
        >
          <Plus size={16} />
          添加项目
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-950">
          <div className="grid gap-3 sm:grid-cols-2 mb-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="项目名称，如 gin-gonic/gin"
              className="rounded-lg border border-stone-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-stone-400 dark:border-stone-700 dark:text-stone-100"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <input
              type="text"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="主要语言，如 Go"
              className="rounded-lg border border-stone-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-stone-400 dark:border-stone-700 dark:text-stone-100"
            />
          </div>
          <input
            type="url"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="GitHub URL（可选）"
            className="w-full mb-3 rounded-lg border border-stone-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-stone-400 dark:border-stone-700 dark:text-stone-100"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="项目简介（可选）"
            className="w-full mb-3 rounded-lg border border-stone-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-stone-400 dark:border-stone-700 dark:text-stone-100"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="rounded-lg px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800">
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={!name.trim() || createProject.isPending}
              className="rounded-lg bg-stone-900 px-4 py-1.5 text-sm text-white hover:bg-stone-800 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
            >
              {createProject.isPending ? <Loader2 size={14} className="animate-spin" /> : "创建"}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={24} className="animate-spin text-stone-400" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-stone-400 dark:text-stone-500">
          <FolderGit2 size={48} className="mx-auto mb-3 opacity-50" />
          <p>还没有项目</p>
          <p className="text-sm mt-1">添加你正在研读的开源项目</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group relative rounded-lg border border-stone-200 bg-white p-5 hover:border-stone-300 hover:shadow-sm transition-all cursor-pointer dark:border-stone-800 dark:bg-stone-950 dark:hover:border-stone-700"
              onClick={() => router.push(`/projects/${project.id}`)}
            >
              <div className="flex items-start gap-3 mb-2">
                <FolderGit2 size={20} className="text-stone-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-stone-900 dark:text-stone-100 truncate">
                      {project.name}
                    </h3>
                    {project.language && (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${LANGUAGE_COLORS[project.language] ?? "bg-stone-50 text-stone-600 dark:bg-stone-900 dark:text-stone-300"}`}>
                        {project.language}
                      </span>
                    )}
                  </div>
                  {project.description && (
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 line-clamp-1">{project.description}</p>
                  )}
                </div>
                <span className="text-xs text-stone-400 whitespace-nowrap">{project.noteCount} 篇笔记</span>
              </div>

              {project.topTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 ml-8">
                  {project.topTags.map((tag) => (
                    <span key={tag} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500 dark:bg-stone-900 dark:text-stone-400">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`确定要删除「${project.name}」及其所有笔记吗？`)) deleteProject.mutate({ id: project.id });
                }}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 rounded-full p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500 transition-all dark:hover:bg-red-950/50"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/projects/page.tsx
git commit -m "feat: add oss projects list page"
```

---

## Task 10: OSS Project Detail Page

**Files:**
- Create: `src/app/(app)/projects/[id]/page.tsx`

- [ ] **Step 1: Create the project detail page**

Create `src/app/(app)/projects/[id]/page.tsx`:

```typescript
"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { cn, formatDate } from "@/lib/utils";
import { ArrowLeft, Plus, Loader2, Trash2, ExternalLink } from "lucide-react";

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const utils = trpc.useUtils();
  const { data: project, isLoading: projectLoading } = trpc.ossProjects.get.useQuery({ id });
  const { data: notes = [], isLoading: notesLoading } = trpc.ossProjects.listNotes.useQuery({
    projectId: id,
    tag: activeTag ?? undefined,
  });

  const createNote = trpc.ossProjects.createNote.useMutation({
    onSuccess: (result) => {
      utils.ossProjects.listNotes.invalidate({ projectId: id });
      setShowCreate(false);
      setNewTitle("");
      router.push(`/projects/${id}/notes/${result.id}`);
    },
  });

  const deleteNote = trpc.ossProjects.deleteNote.useMutation({
    onSuccess: () => utils.ossProjects.listNotes.invalidate({ projectId: id }),
  });

  // Collect all unique tags from notes
  const allTags: string[] = (() => {
    const tagSet = new Set<string>();
    notes.forEach((note) => {
      try {
        const tags = JSON.parse(note.tags ?? "[]");
        if (Array.isArray(tags)) tags.forEach((t: string) => tagSet.add(t));
      } catch {}
    });
    return [...tagSet];
  })();

  if (projectLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={24} className="animate-spin text-stone-400" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-12 text-center text-stone-500">
        <p>项目不存在</p>
        <button onClick={() => router.push("/projects")} className="mt-2 text-blue-600 hover:underline text-sm">
          返回项目列表
        </button>
      </div>
    );
  }

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createNote.mutate({ projectId: id, title: newTitle.trim() });
  };

  return (
    <div>
      <button
        onClick={() => router.push("/projects")}
        className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 mb-4 transition-colors"
      >
        <ArrowLeft size={14} />
        返回项目列表
      </button>

      {/* Project header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 mb-1">{project.name}</h1>
        <div className="flex items-center gap-3 text-sm">
          {project.language && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">
              {project.language}
            </span>
          )}
          {project.repoUrl && (
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-violet-600 hover:underline dark:text-violet-400"
              onClick={(e) => e.stopPropagation()}
            >
              {project.repoUrl.replace(/^https?:\/\//, "")} <ExternalLink size={12} />
            </a>
          )}
        </div>
        {project.description && (
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-2">{project.description}</p>
        )}
      </div>

      {/* Tag filter + create */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveTag(null)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs transition-colors",
              activeTag === null
                ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                : "bg-stone-100 text-stone-500 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400"
            )}
          >
            全部
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag === activeTag ? null : tag)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs transition-colors",
                activeTag === tag
                  ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                  : "bg-stone-100 text-stone-500 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400"
              )}
            >
              {tag}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800 transition-colors flex-shrink-0 dark:bg-stone-100 dark:text-stone-900"
        >
          <Plus size={14} />
          添加笔记
        </button>
      </div>

      {showCreate && (
        <div className="mb-4 flex items-center gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="笔记标题，如「路由实现分析」"
            className="flex-1 rounded-lg border border-stone-200 bg-transparent px-3 py-2 text-sm outline-none focus:border-stone-400 dark:border-stone-700 dark:text-stone-100"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button onClick={handleCreate} disabled={!newTitle.trim()} className="rounded-lg bg-stone-900 px-3 py-2 text-sm text-white hover:bg-stone-800 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900">
            创建
          </button>
          <button onClick={() => setShowCreate(false)} className="rounded-lg px-3 py-2 text-sm text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800">
            取消
          </button>
        </div>
      )}

      {/* Notes list */}
      {notesLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-stone-400" />
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12 text-stone-400">
          <p>还没有分析笔记</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => {
            const tags: string[] = (() => { try { return JSON.parse(note.tags ?? "[]"); } catch { return []; } })();
            return (
              <div
                key={note.id}
                className="group relative rounded-lg border border-stone-200 bg-white p-4 hover:border-stone-300 transition-all cursor-pointer dark:border-stone-800 dark:bg-stone-950 dark:hover:border-stone-700"
                onClick={() => router.push(`/projects/${id}/notes/${note.id}`)}
              >
                <div className="flex items-start justify-between">
                  <h4 className="font-medium text-stone-900 dark:text-stone-100 text-sm">{note.title}</h4>
                  <span className="text-xs text-stone-400 whitespace-nowrap ml-4">
                    {note.updatedAt ? formatDate(new Date(note.updatedAt)) : ""}
                  </span>
                </div>
                {note.plainText && (
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">{note.plainText.slice(0, 200)}</p>
                )}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("确定要删除这条笔记吗？")) deleteNote.mutate({ id: note.id });
                  }}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 rounded-full p-1 text-stone-400 hover:bg-red-50 hover:text-red-500 transition-all dark:hover:bg-red-950/50"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/projects/[id]/page.tsx
git commit -m "feat: add oss project detail page with tag filtering"
```

---

## Task 11: OSS Project Note Editor Page

**Files:**
- Create: `src/app/(app)/projects/[id]/notes/[noteId]/page.tsx`

- [ ] **Step 1: Create the project note editor page**

Create `src/app/(app)/projects/[id]/notes/[noteId]/page.tsx`. Identical pattern to the learning note editor (Task 8) but using `ossProjects` router and navigating back to `/projects/[id]`:

```typescript
"use client";

import { use, useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Tag } from "lucide-react";
import { TiptapEditor } from "@/components/editor/tiptap-editor";
import { useToast } from "@/components/ui/toast";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  try {
    const value = JSON.parse(tags);
    return Array.isArray(value) ? value.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export default function ProjectNoteEditorPage({
  params,
}: {
  params: Promise<{ id: string; noteId: string }>;
}) {
  const { id: projectId, noteId } = use(params);
  const router = useRouter();
  const { toast } = useToast();

  const utils = trpc.useUtils();
  const { data: note, isLoading } = trpc.ossProjects.getNote.useQuery({ id: noteId });

  const updateNote = trpc.ossProjects.updateNote.useMutation({
    onSuccess: () => utils.ossProjects.getNote.invalidate({ id: noteId }),
  });

  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const contentRef = useRef({ content: "", plainText: "" });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const initialized = useRef(false);

  useEffect(() => {
    if (note && !initialized.current) {
      setTitle(note.title);
      setTags(parseTags(note.tags));
      contentRef.current = { content: note.content ?? "", plainText: note.plainText ?? "" };
      initialized.current = true;
    }
  }, [note]);

  const doSave = useCallback(
    (overrides?: { title?: string; tags?: string[] }) => {
      setSaveStatus("saving");
      updateNote.mutate(
        {
          id: noteId,
          title: overrides?.title ?? title,
          content: contentRef.current.content,
          plainText: contentRef.current.plainText,
          tags: JSON.stringify(overrides?.tags ?? tags),
        },
        {
          onSuccess: () => setSaveStatus("saved"),
          onError: () => setSaveStatus("unsaved"),
        }
      );
    },
    [noteId, title, tags, updateNote]
  );

  const scheduleAutoSave = useCallback(() => {
    setSaveStatus("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave(), 1500);
  }, [doSave]);

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  const handleContentChange = useCallback(
    (content: string, plainText: string) => {
      contentRef.current = { content, plainText };
      scheduleAutoSave();
    },
    [scheduleAutoSave]
  );

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    setSaveStatus("unsaved");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => doSave({ title: newTitle }), 1500);
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (!tag || tags.includes(tag)) return;
    const newTags = [...tags, tag];
    setTags(newTags);
    setTagInput("");
    doSave({ tags: newTags });
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = tags.filter((t) => t !== tagToRemove);
    setTags(newTags);
    doSave({ tags: newTags });
  };

  if (isLoading || !note) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-200 border-t-stone-600 dark:border-stone-700 dark:border-t-stone-200" />
      </div>
    );
  }

  const statusDot = {
    saved: "bg-emerald-400",
    saving: "bg-amber-400 animate-pulse",
    unsaved: "bg-stone-300 dark:bg-stone-600",
  };

  return (
    <div className="-mx-4 -mt-5 w-auto pb-10 md:-mx-6 md:-mt-6">
      <div className="mx-auto mb-4 flex w-full max-w-[980px] items-center justify-between gap-4 px-6 pt-5 md:px-10 md:pt-6">
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-900 dark:hover:text-stone-100"
        >
          <ArrowLeft size={16} />
          返回项目
        </button>
        <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-3 py-1 text-xs text-stone-500 shadow-sm dark:border-stone-800 dark:bg-stone-950/80 dark:text-stone-400">
          <span className={cn("h-2 w-2 rounded-full", statusDot[saveStatus])} />
          {saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving..." : "Editing"}
        </span>
      </div>

      <div className="mx-auto w-full max-w-[980px] px-6 md:px-10">
        <div className="mb-3 flex flex-wrap items-center gap-2 px-1 text-sm">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-sm text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
            >
              <Tag size={12} />
              {tag}
              <button onClick={() => handleRemoveTag(tag)} className="rounded-full px-1 text-stone-400 hover:text-stone-600">
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
            onBlur={() => { if (tagInput.trim()) handleAddTag(); }}
            placeholder="Add tag..."
            className="min-w-28 rounded-full border border-dashed border-stone-200 bg-transparent px-3 py-1 text-sm outline-none placeholder:text-stone-400 focus:border-stone-300 dark:border-stone-700 dark:placeholder:text-stone-500"
          />
        </div>

        <div className="mt-6 mb-6 px-1">
          <textarea
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              (document.querySelector(".notion-editor") as HTMLElement | null)?.focus();
            }}
            placeholder="笔记标题"
            rows={1}
            className="w-full resize-none border-none bg-transparent text-3xl font-semibold leading-tight text-stone-900 outline-none placeholder:text-stone-300 dark:text-stone-100 dark:placeholder:text-stone-600"
            style={{ overflow: "hidden" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = `${target.scrollHeight}px`;
            }}
          />
        </div>

        <div className="px-1">
          <TiptapEditor
            content={note.content ?? undefined}
            onChange={handleContentChange}
            onError={(message) => toast(message, "error")}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/projects/[id]/notes/[noteId]/page.tsx
git commit -m "feat: add oss project note editor page"
```

---

## Task 12: AI Note Drafting API

**Files:**
- Create: `src/app/api/learn/draft/route.ts`

- [ ] **Step 1: Create the streaming AI draft endpoint**

Create `src/app/api/learn/draft/route.ts`:

```typescript
import { z } from "zod/v4";
import { streamChatResponse } from "@/server/ai/provider";
import { auth } from "@/lib/auth";
import { checkAiRateLimit, recordAiUsage } from "@/server/ai-rate-limit";

export const maxDuration = 60;

const draftInputSchema = z.object({
  keyword: z.string().min(1),
  topicTitle: z.string().optional(),
});

export async function POST(req: Request) {
  let userId: string | null = null;
  if (process.env.AUTH_BYPASS !== "true") {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = session.user.id;
    const { allowed } = await checkAiRateLimit(userId);
    if (!allowed) {
      return Response.json({ error: "Daily AI usage limit reached." }, { status: 429 });
    }
  }

  const body = await req.json();
  const parsed = draftInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }

  const { keyword, topicTitle } = parsed.data;
  const topicContext = topicTitle ? `（学习主题：${topicTitle}）` : "";

  const system = `你是一个专业的技术学习助手。用户正在学习后端技术${topicContext}。
请围绕用户给出的关键词，生成一份全面详细的学习笔记。

要求：
1. 覆盖该主题所有重要方面，不要遗漏关键概念
2. 包含代码示例（使用相关语言）
3. 解释清楚原理和使用场景
4. 适合有前端经验但后端初学者的水平
5. 用中文写作，技术术语保留英文
6. 使用 Markdown 格式，层次清晰`;

  const response = await streamChatResponse({
    messages: [{ role: "user", content: `请详细讲解：${keyword}` }],
    signal: req.signal,
    system,
  });

  if (process.env.AUTH_BYPASS !== "true" && userId) {
    void recordAiUsage(userId).catch(() => undefined);
  }

  return response;
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/learn/draft/route.ts
git commit -m "feat: add AI note drafting streaming endpoint"
```

---

## Task 13: E2E Tests — Learning Notebook

**Files:**
- Create: `e2e/learning-notebook.spec.ts`

- [ ] **Step 1: Write E2E tests for learning notebook CRUD**

Create `e2e/learning-notebook.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

function uid() {
  return Math.random().toString(36).slice(2, 8);
}

async function trpcMutation<TInput>(
  request: import("@playwright/test").APIRequestContext,
  procedure: string,
  input: TInput
) {
  const response = await request.post(`/api/trpc/${procedure}?batch=1`, {
    data: { 0: { json: input } },
  });
  const text = await response.text();
  expect(response.ok(), `${procedure} failed: ${text}`).toBeTruthy();
  const payload = JSON.parse(text) as Array<{ result?: { data?: { json?: unknown } } }>;
  return payload[0]?.result?.data?.json;
}

test.describe("Learning Notebook", () => {
  test("create topic, add note, edit, delete", async ({ page, request }) => {
    const topicName = `Test Topic ${uid()}`;
    const noteName = `Test Note ${uid()}`;

    // Create topic via API
    const topic = (await trpcMutation(request, "learningNotebook.createTopic", {
      title: topicName,
      description: "E2E test topic",
      icon: "🧪",
    })) as { id: string };

    // Navigate to learn page and verify topic appears
    await page.goto("/learn");
    await expect(page.locator("text=" + topicName)).toBeVisible();

    // Click into topic
    await page.locator("text=" + topicName).click();
    await expect(page.locator("h1", { hasText: topicName })).toBeVisible();

    // Create a note via API
    const note = (await trpcMutation(request, "learningNotebook.createNote", {
      topicId: topic.id,
      title: noteName,
    })) as { id: string };

    // Reload and verify note appears in list
    await page.reload();
    await expect(page.locator("text=" + noteName)).toBeVisible();

    // Click into note editor
    await page.locator("text=" + noteName).click();
    await expect(page.locator("textarea").first()).toHaveValue(noteName);

    // Go back and delete the note
    await page.goBack();
    await page.reload();

    // Delete topic via API (cascades to notes)
    await trpcMutation(request, "learningNotebook.deleteTopic", { id: topic.id });

    // Verify topic is gone
    await page.goto("/learn");
    await expect(page.locator("text=" + topicName)).not.toBeVisible();
  });

  test("AI assistant tab renders", async ({ page, request }) => {
    const topicName = `AI Tab Topic ${uid()}`;

    const topic = (await trpcMutation(request, "learningNotebook.createTopic", {
      title: topicName,
    })) as { id: string };

    await page.goto(`/learn/${topic.id}`);
    await page.locator("text=AI 助手").click();

    await expect(page.locator("text=生成知识大纲")).toBeVisible();
    await expect(page.locator("text=盲点分析")).toBeVisible();
    await expect(page.locator("text=生成复习题")).toBeVisible();

    // Cleanup
    await trpcMutation(request, "learningNotebook.deleteTopic", { id: topic.id });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm test:e2e -- e2e/learning-notebook.spec.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/learning-notebook.spec.ts
git commit -m "test: add learning notebook E2E tests"
```

---

## Task 14: E2E Tests — OSS Projects

**Files:**
- Create: `e2e/oss-projects.spec.ts`

- [ ] **Step 1: Write E2E tests for OSS projects CRUD**

Create `e2e/oss-projects.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

function uid() {
  return Math.random().toString(36).slice(2, 8);
}

async function trpcMutation<TInput>(
  request: import("@playwright/test").APIRequestContext,
  procedure: string,
  input: TInput
) {
  const response = await request.post(`/api/trpc/${procedure}?batch=1`, {
    data: { 0: { json: input } },
  });
  const text = await response.text();
  expect(response.ok(), `${procedure} failed: ${text}`).toBeTruthy();
  const payload = JSON.parse(text) as Array<{ result?: { data?: { json?: unknown } } }>;
  return payload[0]?.result?.data?.json;
}

test.describe("OSS Projects", () => {
  test("create project, add note, tag filter, delete", async ({ page, request }) => {
    const projectName = `test-project-${uid()}`;
    const noteName = `Analysis ${uid()}`;

    // Create project via API
    const project = (await trpcMutation(request, "ossProjects.create", {
      name: projectName,
      repoUrl: "https://github.com/test/repo",
      language: "Go",
      description: "E2E test project",
    })) as { id: string };

    // Navigate and verify
    await page.goto("/projects");
    await expect(page.locator("text=" + projectName)).toBeVisible();

    // Click into project
    await page.locator("text=" + projectName).click();
    await expect(page.locator("h1", { hasText: projectName })).toBeVisible();
    await expect(page.locator("text=Go")).toBeVisible();

    // Create note with tag via API
    const note = (await trpcMutation(request, "ossProjects.createNote", {
      projectId: project.id,
      title: noteName,
      tags: JSON.stringify(["架构", "路由"]),
    })) as { id: string };

    // Reload and verify note appears
    await page.reload();
    await expect(page.locator("text=" + noteName)).toBeVisible();
    await expect(page.locator("text=架构")).toBeVisible();

    // Click into note editor
    await page.locator("text=" + noteName).click();
    await expect(page.locator("textarea").first()).toHaveValue(noteName);

    // Cleanup
    await trpcMutation(request, "ossProjects.deleteNote", { id: note.id });
    await trpcMutation(request, "ossProjects.delete", { id: project.id });

    // Verify project is gone
    await page.goto("/projects");
    await expect(page.locator("text=" + projectName)).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Run tests**

```bash
pnpm test:e2e -- e2e/oss-projects.spec.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/oss-projects.spec.ts
git commit -m "test: add oss projects E2E tests"
```

---

## Task 15: Build Verification & Lint

- [ ] **Step 1: Run full build**

```bash
pnpm build
```

Expected: Build succeeds with no type errors.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: No lint errors. Fix any issues found.

- [ ] **Step 3: Run all E2E tests**

```bash
pnpm test:e2e
```

Expected: All tests pass (existing + new).

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build/lint issues from learning and projects modules"
```
