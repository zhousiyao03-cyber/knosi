# Analysis Live Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real-time display of Claude's tool calls (Read, Grep, Bash, etc.) during source-code analysis, shown as a scrollable timeline in the project detail page.

**Architecture:** Daemon spawns Claude with `--output-format stream-json --verbose`, parses tool_use events line-by-line, batches summaries to `/api/analysis/progress`. Frontend polls `/api/analysis/messages` every 2s and renders a timeline replacing the current blue banner.

**Tech Stack:** Next.js API Routes, Drizzle ORM (SQLite/libsql), Node.js daemon (ESM), Claude CLI stream-json

---

### Task 1: Add `analysis_messages` table

**Files:**
- Modify: `src/server/db/schema.ts` (after `analysisTasks` table, around line 513)

- [ ] **Step 1: Add the table definition**

Add after `analysisTasks` in `src/server/db/schema.ts`:

```typescript
export const analysisMessages = sqliteTable("analysis_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  taskId: text("task_id")
    .notNull()
    .references(() => analysisTasks.id, { onDelete: "cascade" }),
  seq: integer("seq").notNull(),
  type: text("type", { enum: ["tool_use", "tool_result", "text", "error"] }).notNull(),
  tool: text("tool"),
  summary: text("summary"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});
```

- [ ] **Step 2: Generate and push migration**

```bash
cd /Users/bytedance/second-brain && pnpm db:generate && pnpm db:push
```

- [ ] **Step 3: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat: add analysis_messages table for live progress tracking"
```

---

### Task 2: Create `POST /api/analysis/progress` route

**Files:**
- Create: `src/app/api/analysis/progress/route.ts`

- [ ] **Step 1: Create the progress route**

Create `src/app/api/analysis/progress/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { analysisMessages } from "@/server/db/schema";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    taskId: string;
    messages: Array<{
      seq: number;
      type: "tool_use" | "tool_result" | "text" | "error";
      tool?: string;
      summary?: string;
    }>;
  };

  if (!body.taskId || !body.messages?.length) {
    return NextResponse.json({ error: "taskId and messages required" }, { status: 400 });
  }

  for (const msg of body.messages) {
    await db.insert(analysisMessages).values({
      taskId: body.taskId,
      seq: msg.seq,
      type: msg.type,
      tool: msg.tool ?? null,
      summary: msg.summary ?? null,
    });
  }

  return NextResponse.json({ status: "ok", count: body.messages.length });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/analysis/progress/route.ts
git commit -m "feat: add /api/analysis/progress route for daemon message reporting"
```

---

### Task 3: Create `GET /api/analysis/messages` route

**Files:**
- Create: `src/app/api/analysis/messages/route.ts`

- [ ] **Step 1: Create the messages query route**

Create `src/app/api/analysis/messages/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { and, gt, eq, asc } from "drizzle-orm";
import { db } from "@/server/db";
import { analysisMessages } from "@/server/db/schema";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  const afterSeq = parseInt(searchParams.get("afterSeq") ?? "0", 10);

  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  const messages = await db
    .select({
      seq: analysisMessages.seq,
      type: analysisMessages.type,
      tool: analysisMessages.tool,
      summary: analysisMessages.summary,
    })
    .from(analysisMessages)
    .where(
      and(
        eq(analysisMessages.taskId, taskId),
        gt(analysisMessages.seq, afterSeq)
      )
    )
    .orderBy(asc(analysisMessages.seq))
    .limit(200);

  return NextResponse.json({ messages });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/analysis/messages/route.ts
git commit -m "feat: add /api/analysis/messages route for frontend polling"
```

---

### Task 4: Update `analysisStatus` tRPC query to include taskId

**Files:**
- Modify: `src/server/routers/oss-projects.ts:307-319`

The frontend needs the `taskId` to poll messages. Update the `analysisStatus` query to also return the latest running/queued task's ID.

- [ ] **Step 1: Add analysisTasks import and update query**

In `src/server/routers/oss-projects.ts`, add `analysisTasks` to the schema import (it should already be there from the previous feature). Then replace the `analysisStatus` procedure:

```typescript
  analysisStatus: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input, ctx }) => {
      const [project] = await db
        .select({
          analysisStatus: osProjects.analysisStatus,
          analysisError: osProjects.analysisError,
        })
        .from(osProjects)
        .where(and(eq(osProjects.id, input.projectId), eq(osProjects.userId, ctx.userId)));

      if (!project) return { analysisStatus: null, analysisError: null, activeTaskId: null };

      // Find the active task ID for message polling
      let activeTaskId: string | null = null;
      if (project.analysisStatus === "queued" || project.analysisStatus === "running") {
        const [task] = await db
          .select({ id: analysisTasks.id })
          .from(analysisTasks)
          .where(
            and(
              eq(analysisTasks.projectId, input.projectId),
              eq(analysisTasks.status, project.analysisStatus === "queued" ? "queued" : "running")
            )
          )
          .orderBy(analysisTasks.createdAt)
          .limit(1);
        activeTaskId = task?.id ?? null;
      }

      return { ...project, activeTaskId };
    }),
```

- [ ] **Step 2: Commit**

```bash
git add src/server/routers/oss-projects.ts
git commit -m "feat: include activeTaskId in analysisStatus query response"
```

---

### Task 5: Rewrite daemon `spawnClaude` to use stream-json and report messages

**Files:**
- Modify: `tools/usage-reporter/report.mjs:200-224` (spawnClaude function)
- Modify: `tools/usage-reporter/report.mjs:328-365` (handleAnalysisTask function)

- [ ] **Step 1: Add `getToolSummary` helper**

Add this function before `spawnClaude` in `tools/usage-reporter/report.mjs` (around line 199):

```javascript
function getToolSummary(tool, input) {
  if (!input) return tool;
  if (tool === "Read" || tool === "Edit" || tool === "Write") {
    const fp = input.file_path || input.path || "";
    const parts = fp.split("/");
    return parts.slice(-3).join("/");
  }
  if (tool === "Grep") {
    const pattern = input.pattern || "";
    const path = input.path || "";
    const shortPath = path.split("/").slice(-2).join("/");
    return `"${pattern.slice(0, 60)}" in ${shortPath || "."}`;
  }
  if (tool === "Glob") return input.pattern || tool;
  if (tool === "Bash") return input.description || (input.command || "").slice(0, 80);
  return tool;
}
```

- [ ] **Step 2: Replace `spawnClaude` with stream-json version**

Replace the existing `spawnClaude` function (lines 200-224) with:

```javascript
function spawnClaude(prompt, cwd, onMessage) {
  return new Promise((resolve, reject) => {
    const child = cpSpawn(
      "claude",
      ["-p", prompt, "--allowedTools", "Read,Grep,Glob,Bash", "--output-format", "stream-json", "--verbose"],
      { cwd, detached: true, stdio: ["ignore", "pipe", "pipe"] }
    );

    const stderrChunks = [];
    let finalResult = "";
    let lineBuf = "";

    child.stdout.on("data", (chunk) => {
      lineBuf += chunk.toString("utf8");
      const lines = lineBuf.split("\n");
      lineBuf = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);

          // Extract tool_use messages
          if (event.type === "assistant" && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === "tool_use") {
                onMessage({
                  type: "tool_use",
                  tool: block.name,
                  summary: getToolSummary(block.name, block.input),
                });
              } else if (block.type === "text" && block.text) {
                onMessage({
                  type: "text",
                  summary: block.text.slice(0, 120),
                });
              }
            }
          }

          // Extract final result
          if (event.type === "result" && event.result) {
            finalResult = event.result;
          }
        } catch {
          // skip unparseable lines
        }
      }
    });

    child.stderr.on("data", (chunk) => stderrChunks.push(chunk));

    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString("utf8");
        reject(new Error(`claude exited with code ${code}${stderr ? `: ${stderr}` : ""}`));
        return;
      }
      resolve(finalResult);
    });
  });
}
```

- [ ] **Step 3: Update `handleAnalysisTask` to collect and flush messages**

Replace the existing `handleAnalysisTask` function (lines 328-365) with:

```javascript
async function handleAnalysisTask(task) {
  console.log(`[${timestamp()}] 🔬 开始分析: ${task.repoUrl} (${task.taskType})`);

  try {
    const repoDir = cloneRepo(task.repoUrl);

    const prompt =
      task.taskType === "analysis"
        ? buildAnalysisPrompt(task.repoUrl)
        : buildFollowupPrompt(task.originalAnalysis || "", task.question || "");

    // Collect messages and flush periodically
    let seq = 0;
    const pendingMessages = [];
    let flushTimer = null;

    async function flushMessages() {
      if (pendingMessages.length === 0) return;
      const batch = pendingMessages.splice(0);
      try {
        await fetch(`${SERVER_URL}/api/analysis/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id, messages: batch }),
        });
      } catch {
        // skip — non-critical
      }
    }

    function onMessage(msg) {
      seq++;
      pendingMessages.push({ seq, ...msg });
      // Flush every 5 messages or schedule a timer
      if (pendingMessages.length >= 5) {
        flushMessages();
      } else if (!flushTimer) {
        flushTimer = setTimeout(() => {
          flushTimer = null;
          flushMessages();
        }, 2000);
      }
    }

    const result = await spawnClaude(prompt, repoDir, onMessage);

    // Final flush
    if (flushTimer) clearTimeout(flushTimer);
    await flushMessages();

    // Report success
    const res = await fetch(`${SERVER_URL}/api/analysis/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, result }),
    });

    if (!res.ok) {
      throw new Error(`Complete API returned ${res.status}: ${await res.text()}`);
    }

    console.log(`[${timestamp()}] ✅ 分析完成: ${task.repoUrl}`);
  } catch (err) {
    console.error(`[${timestamp()}] ❌ 分析失败: ${task.repoUrl}`, err.message);

    await fetch(`${SERVER_URL}/api/analysis/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, error: err.message }),
    }).catch(() => {});
  } finally {
    analysisRunning--;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add tools/usage-reporter/report.mjs
git commit -m "feat: daemon streams Claude tool calls and reports progress"
```

---

### Task 6: Replace frontend banner with live timeline component

**Files:**
- Modify: `src/app/(app)/projects/[id]/page.tsx:208-218`

- [ ] **Step 1: Add state and polling hook for messages**

In `src/app/(app)/projects/[id]/page.tsx`, add these imports and state after the existing state declarations (around line 28-29):

```typescript
import { useRef, useCallback } from "react";
```

(Note: `useEffect`, `useState`, `useMemo` are already imported. `useRef` needs to be added to the existing import from "react".)

Then add the messages state and polling after the `analysisStatus`/`analysisError` lines (around line 50):

```typescript
  const activeTaskId = analysisInfo?.activeTaskId ?? null;
  const [messages, setMessages] = useState<Array<{ seq: number; type: string; tool?: string; summary?: string }>>([]);
  const lastSeqRef = useRef(0);
  const timelineEndRef = useRef<HTMLDivElement>(null);

  // Poll messages every 2s while running
  useEffect(() => {
    if (!activeTaskId || (analysisStatus !== "queued" && analysisStatus !== "running")) {
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/analysis/messages?taskId=${activeTaskId}&afterSeq=${lastSeqRef.current}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.messages?.length) {
          setMessages((prev) => [...prev, ...data.messages]);
          lastSeqRef.current = data.messages[data.messages.length - 1].seq;
        }
      } catch {
        // skip
      }
    };

    poll(); // initial fetch
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [activeTaskId, analysisStatus]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Reset messages when analysis completes
  useEffect(() => {
    if (analysisStatus === "completed" || analysisStatus === "failed") {
      setMessages([]);
      lastSeqRef.current = 0;
    }
  }, [analysisStatus]);
```

- [ ] **Step 2: Replace the blue banner with the timeline**

Replace the banner block (lines 208-218) with:

```tsx
      {(analysisStatus === "queued" || analysisStatus === "running") && (
        <div className="overflow-hidden rounded-2xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 text-sm font-medium text-blue-700 dark:text-blue-300">
            <Loader2 size={16} className="animate-spin shrink-0" />
            <span className="grow">
              {analysisStatus === "queued"
                ? "Analysis queued — waiting for local daemon…"
                : "Analysing repository with Claude…"}
            </span>
          </div>

          {/* Message timeline */}
          {messages.length > 0 && (
            <div className="max-h-[300px] overflow-y-auto border-t border-blue-200 bg-white/50 px-5 py-3 font-mono text-xs leading-relaxed text-stone-600 dark:border-blue-800 dark:bg-stone-950/50 dark:text-stone-400">
              {messages.map((msg) => (
                <div key={msg.seq} className="py-0.5">
                  {msg.type === "tool_use" && (
                    <span>
                      <span className="text-blue-600 dark:text-blue-400">
                        {msg.tool}
                      </span>{" "}
                      {msg.summary}
                    </span>
                  )}
                  {msg.type === "text" && (
                    <span className="text-stone-500 italic">{msg.summary}</span>
                  )}
                  {msg.type === "error" && (
                    <span className="text-red-600 dark:text-red-400">
                      {msg.summary}
                    </span>
                  )}
                </div>
              ))}
              <div ref={timelineEndRef} />
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 3: Add `useRef` to the existing React import**

Update the import at line 1-3 from:

```typescript
import { use, useEffect, useMemo, useState } from "react";
```

to:

```typescript
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/projects/[id]/page.tsx
git commit -m "feat: replace analysis banner with live message timeline"
```

---

### Task 7: Push migration to production Turso and build verify

**Files:** None (verification only)

- [ ] **Step 1: Push analysis_messages table to Turso**

```bash
node -e "
const { createClient } = require('@libsql/client');
const client = createClient({
  url: 'libsql://database-bisque-ladder-vercel-icfg-tnw2bxcy86redrmrihvdkdl7.aws-us-east-1.turso.io',
  authToken: process.env.TURSO_AUTH_TOKEN
});
client.execute(\`CREATE TABLE IF NOT EXISTS analysis_messages (
  id text PRIMARY KEY NOT NULL,
  task_id text NOT NULL,
  seq integer NOT NULL,
  type text NOT NULL,
  tool text,
  summary text,
  created_at integer,
  FOREIGN KEY (task_id) REFERENCES analysis_tasks(id) ON UPDATE no action ON DELETE cascade
)\`).then(() => console.log('✅ analysis_messages table created'))
.catch(e => console.error('❌', e.message));
"
```

- [ ] **Step 2: TypeScript build check**

```bash
cd /Users/bytedance/second-brain && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: ESLint check**

```bash
cd /Users/bytedance/second-brain && pnpm lint
```

Expected: No new errors from our changes.

- [ ] **Step 4: Commit any fixes and push**

```bash
git push origin main
```

- [ ] **Step 5: Restart daemon**

```bash
kill $(cat ~/.second-brain-usage.pid) 2>/dev/null
nohup node tools/usage-reporter/report.mjs > /tmp/usage-daemon.log 2>&1 &
```
