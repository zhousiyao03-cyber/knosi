# 八股文 Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [`docs/superpowers/specs/2026-04-26-bagu-skill-design.md`](../specs/2026-04-26-bagu-skill-design.md)

**Goal:** Ship a Claude Code skill that turns a topic prompt or pasted question list into senior-engineer-level Q+A cards, automatically filed into a `八股文` folder in the user's knosi knowledge base.

**Architecture:** Two ordered sub-projects: (A) extend the knosi backend `save_to_knosi` MCP tool with an optional `folder` parameter so callers can target arbitrary folders by name; (B) write a single-file global Claude Code skill at `~/.claude/skills/bagu/SKILL.md` that consumes the new MCP capability. The skill is a prompt — no scripts or build pipeline.

**Tech Stack:** TypeScript / Next.js 16 / tRPC v11 / drizzle-orm / SQLite (libsql) / vitest / Claude Code skills.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `src/server/integrations/ai-inbox.ts` | modify | Add `resolveOrCreateNamedFolder(userId, name)` helper alongside existing AI Inbox resolver |
| `src/server/integrations/ai-inbox.test.ts` | **new** | Vitest cases covering get-or-create semantics for arbitrary named folders |
| `src/server/integrations/ai-capture.ts` | modify | Add optional `folder` field to `AiCaptureInput`; branch folder resolution |
| `src/server/integrations/ai-capture.test.ts` | **new** | Vitest cases proving folder-param routing + AI Inbox regression |
| `src/server/integrations/mcp-tools.ts` | modify | Add `folder` to `save_to_knosi` schema + dispatcher pass-through |
| `src/server/integrations/mcp-tools.test.ts` | modify | Vitest case proving MCP `folder` arg flows to `captureAiNote` |
| `~/.claude/skills/bagu/SKILL.md` | **new** | The actual skill prompt (global, not in repo) |

**File-structure decisions:**

- `resolveOrCreateNamedFolder` lives next to `resolveOrCreateAiInboxFolder` in `ai-inbox.ts`. Both resolve folders; splitting them across files would be premature.
- Tests use **vitest** (`.test.ts`) because that is what the new `mcp-tools.test.ts` already uses and it is what `pnpm test:unit` (the script in `package.json`) picks up. The legacy `ai-capture.test.mjs` (node:test) stays untouched — it is not in the vitest include glob and was never wired into CI.
- The skill file is **outside the repo** (in `~/.claude/skills/`) because it is global and reusable across all projects, per the design decision. It is not version-controlled in `knosi/`.

---

## Task 1: `resolveOrCreateNamedFolder` helper

**Files:**
- Modify: `src/server/integrations/ai-inbox.ts`
- Create: `src/server/integrations/ai-inbox.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/server/integrations/ai-inbox.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import {
  resolveOrCreateNamedFolder,
  type AiInboxFolderRepository,
} from "./ai-inbox";

function makeStubRepo(overrides: Partial<AiInboxFolderRepository> = {}): AiInboxFolderRepository {
  return {
    findInboxFolder: async () => null,
    findFolderByName: async () => null,
    findNextRootSortOrder: async () => 0,
    createInboxFolder: async () => {},
    createFolder: async () => {},
    ...overrides,
  };
}

describe("resolveOrCreateNamedFolder", () => {
  it("creates a new top-level folder when none exists", async () => {
    let captured: { id: string; userId: string; name: string; sortOrder: number } | null = null;
    const repo = makeStubRepo({
      findFolderByName: async () => null,
      findNextRootSortOrder: async () => 7,
      createFolder: async (input) => {
        captured = {
          id: input.id,
          userId: input.userId,
          name: input.name,
          sortOrder: input.sortOrder,
        };
      },
    });

    const id = await resolveOrCreateNamedFolder("user-1", "八股文", {
      repo,
      randomUUID: () => "folder-bagu-1",
    });

    expect(id).toBe("folder-bagu-1");
    expect(captured).toEqual({
      id: "folder-bagu-1",
      userId: "user-1",
      name: "八股文",
      sortOrder: 7,
    });
  });

  it("reuses an existing folder by name", async () => {
    const repo = makeStubRepo({
      findFolderByName: async () => ({ id: "folder-existing" }),
      createFolder: async () => {
        throw new Error("should not create when folder exists");
      },
    });

    const id = await resolveOrCreateNamedFolder("user-1", "八股文", {
      repo,
      randomUUID: () => "should-not-be-used",
    });

    expect(id).toBe("folder-existing");
  });

  it("trims whitespace from the folder name before lookup and create", async () => {
    let lookedUp = "";
    let createdName = "";
    const repo = makeStubRepo({
      findFolderByName: async (_userId, name) => {
        lookedUp = name;
        return null;
      },
      createFolder: async (input) => {
        createdName = input.name;
      },
    });

    await resolveOrCreateNamedFolder("user-1", "  八股文  ", {
      repo,
      randomUUID: () => "id",
    });

    expect(lookedUp).toBe("八股文");
    expect(createdName).toBe("八股文");
  });

  it("rejects empty / whitespace-only name", async () => {
    const repo = makeStubRepo();
    await expect(
      resolveOrCreateNamedFolder("user-1", "   ", { repo, randomUUID: () => "x" })
    ).rejects.toThrow(/non-empty/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/server/integrations/ai-inbox.test.ts`
Expected: FAIL — `resolveOrCreateNamedFolder` and `findFolderByName` are not exported from `ai-inbox`.

- [ ] **Step 3: Implement helper in `ai-inbox.ts`**

Open `src/server/integrations/ai-inbox.ts` and modify it as below. The diff:
- Add `findFolderByName` to the `AiInboxFolderRepository` interface
- Add `createFolder` (generic, takes `name`) to the interface
- Implement both in `createAiInboxFolderRepository`
- Export new `resolveOrCreateNamedFolder` function

Replace the entire file contents with:

```ts
import crypto from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

import { folders } from "../db/schema";

export const AI_INBOX_FOLDER_NAME = "AI Inbox";

export type AiInboxFolderRepository = {
  findInboxFolder(userId: string): Promise<{ id: string } | null>;
  findFolderByName(userId: string, name: string): Promise<{ id: string } | null>;
  findNextRootSortOrder(userId: string): Promise<number>;
  createInboxFolder(input: {
    id: string;
    userId: string;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<void>;
  createFolder(input: {
    id: string;
    userId: string;
    name: string;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<void>;
};

type AiInboxDbRunner = {
  select: (...args: unknown[]) => {
    from: (table: unknown) => {
      where: (clause: unknown) => Promise<Array<Record<string, unknown>>> & {
        limit: (count: number) => Promise<Array<Record<string, unknown>>>;
      };
    };
  };
  insert: (...args: unknown[]) => {
    values: (value: unknown) => Promise<unknown>;
  };
};

export function createAiInboxFolderRepository(
  runner: AiInboxDbRunner
): AiInboxFolderRepository {
  return {
    async findInboxFolder(userId: string) {
      const [existing] = (await runner
        .select({ id: folders.id })
        .from(folders)
        .where(
          and(
            eq(folders.userId, userId),
            eq(folders.name, AI_INBOX_FOLDER_NAME),
            sql`${folders.parentId} is null`
          )
        )
        .limit(1)) as Array<{ id: string }>;

      return existing ? { id: existing.id } : null;
    },

    async findFolderByName(userId: string, name: string) {
      const [existing] = (await runner
        .select({ id: folders.id })
        .from(folders)
        .where(
          and(
            eq(folders.userId, userId),
            eq(folders.name, name),
            sql`${folders.parentId} is null`
          )
        )
        .limit(1)) as Array<{ id: string }>;

      return existing ? { id: existing.id } : null;
    },

    async findNextRootSortOrder(userId: string) {
      const [row] = (await runner
        .select({
          max: sql<number>`coalesce(max(${folders.sortOrder}), -1)`,
        })
        .from(folders)
        .where(
          and(eq(folders.userId, userId), sql`${folders.parentId} is null`)
        )) as Array<{ max?: number }>;

      return (row?.max ?? -1) + 1;
    },

    async createInboxFolder(input) {
      await runner.insert(folders).values({
        id: input.id,
        userId: input.userId,
        name: AI_INBOX_FOLDER_NAME,
        parentId: null,
        sortOrder: input.sortOrder,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
      });
    },

    async createFolder(input) {
      await runner.insert(folders).values({
        id: input.id,
        userId: input.userId,
        name: input.name,
        parentId: null,
        sortOrder: input.sortOrder,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
      });
    },
  };
}

async function getDefaultAiInboxFolderRepository() {
  const { db } = await import("../db/index");
  return createAiInboxFolderRepository(db as unknown as AiInboxDbRunner);
}

export async function resolveOrCreateAiInboxFolder(
  userId: string,
  options: {
    repo?: AiInboxFolderRepository;
    randomUUID?: () => string;
  } = {}
) {
  const repo = options.repo ?? (await getDefaultAiInboxFolderRepository());
  const existing = await repo.findInboxFolder(userId);
  if (existing) {
    return existing.id;
  }

  const id = options.randomUUID?.() ?? crypto.randomUUID();
  const sortOrder = await repo.findNextRootSortOrder(userId);
  const now = new Date();
  await repo.createInboxFolder({
    id,
    userId,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function resolveOrCreateNamedFolder(
  userId: string,
  rawName: string,
  options: {
    repo?: AiInboxFolderRepository;
    randomUUID?: () => string;
  } = {}
) {
  const name = rawName.trim();
  if (!name) {
    throw new Error("resolveOrCreateNamedFolder: name must be a non-empty string");
  }

  const repo = options.repo ?? (await getDefaultAiInboxFolderRepository());
  const existing = await repo.findFolderByName(userId, name);
  if (existing) {
    return existing.id;
  }

  const id = options.randomUUID?.() ?? crypto.randomUUID();
  const sortOrder = await repo.findNextRootSortOrder(userId);
  const now = new Date();
  await repo.createFolder({
    id,
    userId,
    name,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:unit src/server/integrations/ai-inbox.test.ts`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/server/integrations/ai-inbox.ts src/server/integrations/ai-inbox.test.ts
git commit -m "feat(mcp): add resolveOrCreateNamedFolder helper

Generic get-or-create folder resolver alongside the existing AI Inbox
resolver. Used by upcoming save_to_knosi folder param.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Plumb `folder` through `captureAiConversation`

**Files:**
- Modify: `src/server/integrations/ai-capture.ts`
- Create: `src/server/integrations/ai-capture.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/server/integrations/ai-capture.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { captureAiNote } from "./ai-capture";

describe("captureAiNote folder routing", () => {
  it("routes to AI Inbox when no folder param is given (regression)", async () => {
    let inboxCalls = 0;
    let namedCalls = 0;
    let insertedFolderId = "";

    await captureAiNote(
      {
        userId: "user-1",
        sourceApp: "claude-web",
        messages: [
          { role: "user", content: "Q?" },
          { role: "assistant", content: "A." },
        ],
        capturedAtLabel: "2026-04-26 09:00 UTC",
        capturedAt: new Date("2026-04-26T09:00:00.000Z"),
      },
      {
        now: () => new Date("2026-04-26T09:00:00.000Z"),
        randomUUID: () => "note-1",
        resolveOrCreateAiInboxFolder: async () => {
          inboxCalls++;
          return "folder-ai-inbox";
        },
        resolveOrCreateNamedFolder: async () => {
          namedCalls++;
          return "should-not-happen";
        },
        createNote: async (row) => {
          insertedFolderId = row.folderId;
        },
        enqueueNoteIndexJob: async () => undefined,
        invalidateNotesListForUser: () => {},
        invalidateDashboardForUser: () => {},
      }
    );

    expect(inboxCalls).toBe(1);
    expect(namedCalls).toBe(0);
    expect(insertedFolderId).toBe("folder-ai-inbox");
  });

  it("routes to a named folder when folder param is given", async () => {
    let inboxCalls = 0;
    let resolvedName = "";
    let insertedFolderId = "";

    await captureAiNote(
      {
        userId: "user-1",
        sourceApp: "bagu-skill",
        folder: "八股文",
        messages: [{ role: "assistant", content: "Card body" }],
        capturedAtLabel: "2026-04-26 09:00 UTC",
        capturedAt: new Date("2026-04-26T09:00:00.000Z"),
      },
      {
        now: () => new Date("2026-04-26T09:00:00.000Z"),
        randomUUID: () => "note-bagu-1",
        resolveOrCreateAiInboxFolder: async () => {
          inboxCalls++;
          return "should-not-happen";
        },
        resolveOrCreateNamedFolder: async (_userId, name) => {
          resolvedName = name;
          return "folder-bagu";
        },
        createNote: async (row) => {
          insertedFolderId = row.folderId;
        },
        enqueueNoteIndexJob: async () => undefined,
        invalidateNotesListForUser: () => {},
        invalidateDashboardForUser: () => {},
      }
    );

    expect(inboxCalls).toBe(0);
    expect(resolvedName).toBe("八股文");
    expect(insertedFolderId).toBe("folder-bagu");
  });

  it("treats whitespace-only folder as absent and falls back to AI Inbox", async () => {
    let inboxCalls = 0;
    let namedCalls = 0;

    await captureAiNote(
      {
        userId: "user-1",
        sourceApp: "claude-web",
        folder: "   ",
        messages: [{ role: "user", content: "Q?" }],
        capturedAt: new Date("2026-04-26T09:00:00.000Z"),
      },
      {
        now: () => new Date("2026-04-26T09:00:00.000Z"),
        randomUUID: () => "note-2",
        resolveOrCreateAiInboxFolder: async () => {
          inboxCalls++;
          return "folder-ai-inbox";
        },
        resolveOrCreateNamedFolder: async () => {
          namedCalls++;
          return "no";
        },
        createNote: async () => {},
        enqueueNoteIndexJob: async () => undefined,
        invalidateNotesListForUser: () => {},
        invalidateDashboardForUser: () => {},
      }
    );

    expect(inboxCalls).toBe(1);
    expect(namedCalls).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/server/integrations/ai-capture.test.ts`
Expected: FAIL — TypeScript will reject `folder` on `AiCaptureInput` and `resolveOrCreateNamedFolder` on `AiCaptureDependencies`. Even if it compiled, the second test would fail because the named-folder path is not wired.

- [ ] **Step 3: Add `folder` field to `AiCaptureInput`**

In `src/server/integrations/ai-capture.ts`, find:

```ts
export type AiCaptureInput = {
  userId: string;
  sourceApp: string;
  messages: AiCaptureMessage[];
  title?: string | null;
  sourceMeta?: Record<string, unknown>;
  capturedAt?: Date | string | number;
  capturedAtLabel?: string;
};
```

Replace with:

```ts
export type AiCaptureInput = {
  userId: string;
  sourceApp: string;
  messages: AiCaptureMessage[];
  title?: string | null;
  sourceMeta?: Record<string, unknown>;
  capturedAt?: Date | string | number;
  capturedAtLabel?: string;
  /**
   * Optional top-level folder name. When provided (and non-empty after trim),
   * the note is routed via `resolveOrCreateNamedFolder` instead of the
   * default AI Inbox path.
   */
  folder?: string | null;
};
```

- [ ] **Step 4: Add `resolveOrCreateNamedFolder` to dependencies**

In the same file, update the imports at the top:

```ts
import {
  createAiInboxFolderRepository,
  resolveOrCreateAiInboxFolder as resolveOrCreateAiInboxFolderBase,
  resolveOrCreateNamedFolder as resolveOrCreateNamedFolderBase,
  type AiInboxFolderRepository,
} from "./ai-inbox";
```

Find:

```ts
export type AiCaptureDependencies = {
  now?: () => Date;
  randomUUID?: () => string;
  markdownToTiptap?: typeof markdownToTiptap;
  enqueueNoteIndexJob?: (noteId: string, reason: string) => Promise<unknown>;
  invalidateNotesListForUser?: (userId: string) => void;
  invalidateDashboardForUser?: (userId: string) => void;
  resolveOrCreateAiInboxFolder?: (
    userId: string,
    options?: {
      repo?: AiInboxFolderRepository;
      randomUUID?: () => string;
    }
  ) => Promise<string>;
  inboxRepo?: AiInboxFolderRepository;
  createNote?: (input: {
    id: string;
    userId: string;
    title: string;
    content: string;
    plainText: string;
    folderId: string;
    type: "note";
  }) => Promise<void>;
};
```

Add a new field:

```ts
export type AiCaptureDependencies = {
  now?: () => Date;
  randomUUID?: () => string;
  markdownToTiptap?: typeof markdownToTiptap;
  enqueueNoteIndexJob?: (noteId: string, reason: string) => Promise<unknown>;
  invalidateNotesListForUser?: (userId: string) => void;
  invalidateDashboardForUser?: (userId: string) => void;
  resolveOrCreateAiInboxFolder?: (
    userId: string,
    options?: {
      repo?: AiInboxFolderRepository;
      randomUUID?: () => string;
    }
  ) => Promise<string>;
  resolveOrCreateNamedFolder?: (
    userId: string,
    name: string,
    options?: {
      repo?: AiInboxFolderRepository;
      randomUUID?: () => string;
    }
  ) => Promise<string>;
  inboxRepo?: AiInboxFolderRepository;
  createNote?: (input: {
    id: string;
    userId: string;
    title: string;
    content: string;
    plainText: string;
    folderId: string;
    type: "note";
  }) => Promise<void>;
};
```

- [ ] **Step 5: Branch folder resolution inside `captureAiConversation`**

Find this block in `captureAiConversation`:

```ts
  const resolveFolderImpl =
    dependencies.resolveOrCreateAiInboxFolder ??
    resolveOrCreateAiInboxFolderBase;
  const repo =
    dependencies.inboxRepo ??
    (dependencies.resolveOrCreateAiInboxFolder
      ? undefined
      : await getDefaultAiInboxFolderRepository());
```

…and the later usage:

```ts
  const folderId = await resolveFolderImpl(input.userId, {
    repo,
    randomUUID,
  });
```

Replace both with:

```ts
  const resolveInboxImpl =
    dependencies.resolveOrCreateAiInboxFolder ??
    resolveOrCreateAiInboxFolderBase;
  const resolveNamedImpl =
    dependencies.resolveOrCreateNamedFolder ??
    resolveOrCreateNamedFolderBase;
  const repo =
    dependencies.inboxRepo ??
    (dependencies.resolveOrCreateAiInboxFolder ||
    dependencies.resolveOrCreateNamedFolder
      ? undefined
      : await getDefaultAiInboxFolderRepository());
```

Then replace the `folderId` resolution further down with:

```ts
  const trimmedFolder =
    typeof input.folder === "string" ? input.folder.trim() : "";
  const folderId = trimmedFolder
    ? await resolveNamedImpl(input.userId, trimmedFolder, {
        repo,
        randomUUID,
      })
    : await resolveInboxImpl(input.userId, {
        repo,
        randomUUID,
      });
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test:unit src/server/integrations/ai-capture.test.ts`
Expected: PASS — all 3 tests green.

Also re-run the AI Inbox tests to confirm no regression:

Run: `pnpm test:unit src/server/integrations/ai-inbox.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/integrations/ai-capture.ts src/server/integrations/ai-capture.test.ts
git commit -m "feat(mcp): plumb folder param through captureAiConversation

When AiCaptureInput.folder is set (non-empty after trim), route via
resolveOrCreateNamedFolder instead of the default AI Inbox path. Empty
or absent folder preserves existing behaviour.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Plumb `folder` through MCP dispatcher + schema

**Files:**
- Modify: `src/server/integrations/mcp-tools.ts`
- Modify: `src/server/integrations/mcp-tools.test.ts`

- [ ] **Step 1: Write the failing test in `mcp-tools.test.ts`**

Open `src/server/integrations/mcp-tools.test.ts` and add this test inside the existing `describe("callKnosiMcpTool structuredContent shape", () => { ... })` block (just before the closing `});`):

```ts
  it("forwards save_to_knosi folder argument to captureAiNote", async () => {
    let receivedFolder: string | null | undefined = "<unset>";
    const result = await callKnosiMcpTool(
      {
        userId: "u1",
        name: "save_to_knosi",
        arguments: {
          sourceApp: "bagu-skill",
          folder: "八股文",
          messages: [{ role: "assistant", content: "Card" }],
        },
      },
      makeDeps({
        captureAiNote: async (input) => {
          receivedFolder = input.folder ?? null;
          return { noteId: "n1", folderId: "folder-bagu", title: "T" };
        },
      })
    );
    expect(receivedFolder).toBe("八股文");
    expect(result).toEqual({ noteId: "n1", folderId: "folder-bagu", title: "T" });
  });

  it("omits folder from captureAiNote when arg absent", async () => {
    let receivedFolder: string | null | undefined = "<unset>";
    await callKnosiMcpTool(
      {
        userId: "u1",
        name: "save_to_knosi",
        arguments: {
          sourceApp: "claude-web",
          messages: [{ role: "user", content: "Q?" }],
        },
      },
      makeDeps({
        captureAiNote: async (input) => {
          receivedFolder = input.folder;
          return { noteId: "n1", folderId: "f1", title: "T" };
        },
      })
    );
    expect(receivedFolder).toBeUndefined();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:unit src/server/integrations/mcp-tools.test.ts`
Expected: FAIL — `receivedFolder` is `undefined` (not `"八股文"`) in the first test, because the dispatcher silently drops unknown args.

- [ ] **Step 3: Add `folder` to `KNOSI_MCP_TOOLS` schema**

In `src/server/integrations/mcp-tools.ts`, find the `save_to_knosi` entry in `KNOSI_MCP_TOOLS`:

```ts
  {
    name: "save_to_knosi",
    description: "Save an explicit AI conversation excerpt into the user's AI Inbox.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        sourceApp: { type: "string" },
        capturedAtLabel: { type: "string" },
        sourceMeta: { type: "object" },
        messages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string" },
              content: { type: "string" },
            },
            required: ["role", "content"],
          },
        },
      },
      required: ["sourceApp", "messages"],
    },
  },
```

Replace with:

```ts
  {
    name: "save_to_knosi",
    description:
      "Save an explicit AI conversation excerpt into the user's Knosi knowledge base. " +
      "Defaults to the AI Inbox folder. Pass `folder` to route the note into a named " +
      "top-level folder (created on first use).",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        sourceApp: { type: "string" },
        capturedAtLabel: { type: "string" },
        sourceMeta: { type: "object" },
        folder: {
          type: "string",
          description:
            "Optional top-level folder name. When non-empty, the note is filed there " +
            "(folder is created if missing). Empty/omitted = AI Inbox.",
        },
        messages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string" },
              content: { type: "string" },
            },
            required: ["role", "content"],
          },
        },
      },
      required: ["sourceApp", "messages"],
    },
  },
```

- [ ] **Step 4: Pass `folder` through in the `save_to_knosi` dispatcher case**

In the same file, find the `case "save_to_knosi":` block (around line 125). Replace it with:

```ts
    case "save_to_knosi":
      return deps.captureAiNote({
        userId: input.userId,
        title:
          typeof input.arguments.title === "string" ? input.arguments.title : undefined,
        sourceApp: String(input.arguments.sourceApp ?? "claude-web"),
        capturedAtLabel:
          typeof input.arguments.capturedAtLabel === "string"
            ? input.arguments.capturedAtLabel
            : new Date().toISOString(),
        sourceMeta:
          input.arguments.sourceMeta && typeof input.arguments.sourceMeta === "object"
            ? (input.arguments.sourceMeta as Record<string, unknown>)
            : undefined,
        folder:
          typeof input.arguments.folder === "string"
            ? input.arguments.folder
            : undefined,
        messages: Array.isArray(input.arguments.messages)
          ? input.arguments.messages
              .filter(
                (message): message is { role: string; content: string } =>
                  Boolean(
                    message &&
                      typeof message === "object" &&
                      typeof (message as { role?: unknown }).role === "string" &&
                      typeof (message as { content?: unknown }).content === "string"
                  )
              )
              .map((message) => ({
                role: message.role,
                content: message.content,
              }))
          : [],
      });
```

(The only change is the new `folder:` line and the updated description string in `KNOSI_MCP_TOOLS`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test:unit src/server/integrations/mcp-tools.test.ts`
Expected: PASS — all tests in the file (including the two new ones) green.

- [ ] **Step 6: Commit**

```bash
git add src/server/integrations/mcp-tools.ts src/server/integrations/mcp-tools.test.ts
git commit -m "feat(mcp): expose folder param on save_to_knosi MCP tool

Adds optional 'folder' string to the save_to_knosi schema and forwards
it to captureAiNote. Empty/omitted preserves AI Inbox behaviour.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Full verification + deploy

**Files:** none (verification + commit + push only)

- [ ] **Step 1: Run full unit test suite**

Run: `pnpm test:unit`
Expected: PASS — all vitest tests green. Specifically, the new tests in `ai-inbox.test.ts`, `ai-capture.test.ts`, and `mcp-tools.test.ts` all pass.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: 0 errors.

- [ ] **Step 3: Run build**

Run: `pnpm build`
Expected: completes with no TypeScript errors.

- [ ] **Step 4: Run e2e smoke**

Run: `pnpm test:e2e`
Expected: PASS — no regression in existing flows.

(If e2e is too slow / flaky in this environment, justify skipping in the final handoff note. But all four checks are project policy per CLAUDE.md.)

- [ ] **Step 5: Confirm git status is clean before push**

Run: `git status`
Expected: branch is clean (no uncommitted code changes from this work). Pre-existing modified files in the working tree (those listed at the start of the session like `scripts/backfill-embeddings.mjs`) are NOT this work and should NOT be committed.

- [ ] **Step 6: Push to main (auto-deploys to Hetzner)**

Run: `git push origin main`
Expected: push succeeds; GitHub Actions `deploy-hetzner.yml` workflow runs lint and deploys.

- [ ] **Step 7: Verify production deploy**

Run: `gh run list --workflow=deploy-hetzner.yml --limit 1`
Expected: most recent run is the new push and is `completed success`. Wait for it to finish if still running.

Then verify the live MCP tool list now includes `folder`:

```bash
curl -s https://www.knosi.xyz/api/mcp/tools 2>&1 | head -100
```

Expected: response (or whatever the live MCP discovery endpoint is) includes the new `folder` property under `save_to_knosi`. If there is no public discovery endpoint, sanity-check by sending a test save with the folder param via curl or by triggering Task 6 step 1 directly.

---

## Task 5: Create the bagu skill file

**Files:**
- Create: `~/.claude/skills/bagu/SKILL.md` (note: outside the `D:\repos\knosi` repo, this is the global Claude Code skills directory)

- [ ] **Step 1: Confirm `~/.claude/skills/` exists and create `bagu/` subdirectory**

Run (Windows bash):
```bash
mkdir -p ~/.claude/skills/bagu
ls -la ~/.claude/skills/
```
Expected: `bagu/` directory exists; other existing skills (if any) are visible.

- [ ] **Step 2: Write `SKILL.md`**

Create the file `~/.claude/skills/bagu/SKILL.md` with the following exact contents:

````markdown
---
name: bagu
description: Use when the user wants to organize "八股文" (interview-style Q&A) for LLM applications, backend, or system design — either by topic ("整理八股 RAG", "八股 后端缓存") or by pasting a question list (text or screenshot) and asking for cards/notes. Generates senior-engineer level answers and writes one knosi note per question into the 八股文 folder via the knosi MCP. Do NOT trigger when the user is just discussing one interview question or asking for an example answer — only when they want to organize/store a batch.
---

# 八股文 Skill

Generate senior-engineer-level interview-style Q+A cards and file each one as a separate note in the user's knosi `八股文` folder.

## Mode detection

Detect which mode the user is in:

- **P1 — Topic mode**: user names a topic without supplying any candidate questions. Examples: "整理八股 RAG", "给我来 10 道大模型应用八股", "八股 后端缓存". You generate the questions yourself.
- **P2 — List mode**: user supplies candidate questions explicitly — pasted text, attached image(s), or a mix. You answer the questions they gave you.

If the topic is too broad to generate good questions (e.g. "整理八股 后端", "八股 系统设计"), ask one clarifying question before generating. Pick a more focused subtopic.

If the user's intent is ambiguous between asking ONE question vs. organizing a batch (e.g. "讲讲 RAG"), ask whether they want a single explanation or a batch of cards. Default to discussion, not skill activation.

## P1 — Topic mode flow

1. Echo the topic understanding back in one sentence so the user can interrupt if you misread.
2. Generate `N` questions (default `N = 10`; honor explicit overrides like "20 道", "5 道").
3. For each question, write the full answer using the template in §"Note template", plus 2–5 Chinese tags. Tags should be specific (e.g. `RAG`, `向量检索`, `Reranker`) not generic (`大模型`).
4. Run the write loop in §"Saving each card".
5. End with the summary in §"Final report".

## P2 — List mode flow

1. Read all input. For images, use built-in vision to extract each question. For pasted text, parse line-by-line or by numbered list.
2. **Confirmation checkpoint** — show the user the parsed list:
   ```
   读到这些题（N 道），确认后开始写答案：
   1. ...
   2. ...
   ```
   For unreadable / handwritten text, list those items separately and ask the user to retype them. Do not guess.
3. If `N >= 30`, ask "这批有 N 道，是否分批？" before proceeding.
4. After confirmation, write each one using the template + tags as in P1.
5. Run the write loop in §"Saving each card".
6. End with the summary in §"Final report".

## Senior-engineer voice — non-negotiable

- Lead with the load-bearing answer. Drop preambles ("这是一个很好的问题...", "我们可以从几个层面来看...").
- "常见追问" must reflect what an actual interviewer would ask after a candidate's first answer — not generic follow-ups. If the answer is "Reranker 用 cross-encoder", the follow-up is "为什么不直接用 bi-encoder + 大 top-k？" — not "Reranker 还有哪些类型？".
- "易错点" must list things a junior would get wrong but a senior would catch. Concrete, not vague.
- Code blocks only when they actually clarify (config snippets, key API calls). Skip when the answer is conceptual.
- 中文为主，专业术语保留英文（如 `embedding`, `cross-encoder`, `top-k`）。

## Note template

Render each card's body as Markdown with this exact structure. **Drop any section whose content does not apply** — never leave an empty heading.

```markdown
# {question}

> {one-liner answer, ≤30 chars}

## 核心原理
{200–400 字。讲透 why & how。可以分段但不必硬塞子标题。}

## 代码 / 示意

```{lang}
{code}
```

## 常见追问
- Q: {follow-up 1}
  A: {short answer}
- Q: {follow-up 2}
  A: {short answer}

## 易错点 / 反直觉
- {senior-only insight 1}
- {senior-only insight 2}

## 何时用 / 何时不用
- ✅ 适用：...
- ❌ 不适用：...
```

## Saving each card

For each card, call the knosi MCP tool to save:

```
mcp__0b273582-b9d0-49dd-94d8-2b4d32e10990__save_to_knosi({
  sourceApp: "bagu-skill",
  folder: "八股文",
  title: <the question text, full>,
  capturedAtLabel: <ISO timestamp>,
  messages: [
    { role: "assistant", content: <the rendered markdown body> }
  ],
  sourceMeta: {
    tags: [<tag1>, <tag2>, ...],
    topic: <P1 input topic, or "list-mode" for P2>,
    category: "bagu",
    template: "v1"
  }
})
```

**Per-call error handling:** if a single save fails, log the error locally and continue with the next card. Do NOT stop the loop.

**MCP unreachable:** if the very first save attempt errors with a transport-level failure (not a 4xx), abort early and tell the user — do not pretend later writes happened. Do not retry silently.

## Final report

After the write loop, output a summary:

```
✅ 已写入 N 题到 knosi 八股文 folder

题目：
1. {title 1}  [tag1, tag2]
2. {title 2}  [tag1, tag3]
...

❌ 失败 M 题：
- {title}: {error}
```

Include a link the user can click: https://www.knosi.xyz (folder navigation in the sidebar).

## Out of scope

This skill does NOT:
- Run any spaced-repetition / SRS scheduling
- Dedup against existing knosi notes (duplicates are accepted)
- Write code into the user's repos (only writes notes via MCP)
- Generate questions in English unless the user explicitly asks for English
````

- [ ] **Step 3: Verify file was written**

Run:
```bash
ls -la ~/.claude/skills/bagu/
head -10 ~/.claude/skills/bagu/SKILL.md
```
Expected: `SKILL.md` exists; first 10 lines show the YAML frontmatter and `# 八股文 Skill` heading.

- [ ] **Step 4: Restart Claude Code so the skill is picked up**

Tell the user: "Skill written. Please run `/skill list` (or restart this Claude Code session) to confirm `bagu` shows up in the available skills list before smoke-testing."

(No commit — this file lives outside the repo.)

---

## Task 6: Manual smoke test against production

**Files:** none (manual verification only)

These three smoke tests must all pass before declaring the feature shipped. Run each in a **fresh Claude Code session** so we test the real skill activation path, not artifacts from this conversation.

- [ ] **Step 1: P1 (topic mode) smoke**

Open a new Claude Code session in any directory. Type:

```
整理八股 RAG
```

Expected behaviour:
1. Skill activates (you should see the skill being invoked).
2. Claude echoes "整理 RAG 方向，生成 10 道题" or similar.
3. Claude writes 10 questions, each as a separate note, into the `八股文` folder via MCP.
4. Final summary lists 10 titles + tags.
5. Open https://www.knosi.xyz → sidebar shows `八股文` folder with 10 notes. Open one — content matches the 6-section template (or has appropriate sections dropped).

- [ ] **Step 2: P2 (text list) smoke**

In a fresh session, paste:

```
帮我整理八股，下面是题目：
1. 什么是 prompt injection？
2. 怎么做 LLM 应用的 evals？
3. 为什么要用 streaming response？
4. RAG 检索质量怎么评估？
5. function calling 和 tool use 区别？
```

Expected:
1. Skill activates (P2 mode).
2. Claude shows the parsed list and asks for confirmation.
3. After confirmation, writes 5 notes with reasonable tags.
4. All 5 appear in `八股文` folder on knosi.

- [ ] **Step 3: P2 (image) smoke**

In a fresh session, paste a screenshot containing 3+ interview questions (any source: 小红书 / 微信公众号 / blog).

Expected:
1. Skill activates and uses vision to extract questions.
2. Confirmation step shows the parsed questions.
3. After confirmation, notes land in `八股文` with sensible tags.
4. Any unreadable text is surfaced in the confirmation step, not silently guessed.

- [ ] **Step 4: Record results**

Append a changelog entry to `docs/changelog/` describing what was tested and any rough edges. Format follows existing changelog convention — date, task, what shipped, verification commands, follow-ups.

- [ ] **Step 5: Final commit (changelog only)**

```bash
git add docs/changelog/2026-04-26-bagu-skill.md
git commit -m "docs(changelog): bagu skill ships — folder param + global skill

- Backend: save_to_knosi now accepts optional 'folder' param (auto get-or-create)
- Skill: ~/.claude/skills/bagu/SKILL.md generates senior-level Q+A cards into knosi 八股文 folder
- Three smoke flows verified: topic mode, pasted text list, pasted screenshot

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git push origin main
```

---

## Done definition

The work is complete when:

1. All 6 tasks are checked off.
2. `pnpm test:unit && pnpm lint && pnpm build && pnpm test:e2e` all pass on the current commit.
3. Production deploy from Task 4 is healthy.
4. All three smoke flows in Task 6 pass against production knosi.
5. Changelog entry is committed.

Anything less is not done.
