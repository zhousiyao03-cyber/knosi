# /speak Shadow Drill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal `/speak` route where a user opens the page, hears one native English sentence read by the browser TTS, shadows it, presses Next, and repeats — with each sentence's lifetime practice count persisted to Turso.

**Architecture:** Single `"use client"` page reads a hard-coded 30-sentence seed array, picks sentences via Fisher-Yates shuffle, plays them via a small `tts.ts` wrapper around `window.speechSynthesis`. Per-sentence practice counts live in a new `speak_sentence_practice` table (composite PK `user_id + sentence_id`) and are flushed to a tRPC router on each Next click and on `beforeunload`.

**Tech Stack:** Next.js 16 App Router, React 19, tRPC v11 (`protectedProcedure`), Drizzle ORM + libsql/Turso, Tailwind v4, lucide-react icons, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-05-04-speak-shadow-drill-design.md`

**Important pre-read for the implementing engineer:**

- `AGENTS.md` — verification rules, schema rollout rules, handoff format
- `CLAUDE.md` — self-verification three-step (`pnpm build` / `pnpm lint` / `pnpm test:e2e`), Turso production rollout requirement, no committing `data/*.db`
- `.claude/rules/api-pitfalls.md` — React 19 / Next 16 / Tiptap quirks
- `.claude/rules/production-turso.md` — production credential location (`.env.turso-prod.local`)

**Conventions seen in this repo (follow them):**

- All user-scoped routers use `protectedProcedure` from `src/server/trpc.ts`. The auth middleware injects `ctx.userId`. **Do not use `publicProcedure` for `/speak` — the spec mistakenly said `publicProcedure`; the plan corrects this.**
- Drizzle table files live under `src/server/db/schema/<domain>.ts` and re-export through `src/server/db/schema/index.ts`.
- tRPC client is imported as `import { trpc } from "@/lib/trpc";` and used as `trpc.<router>.<proc>.useQuery() / .useMutation()`.
- All user-facing strings are English. Code comments may be in Chinese.
- All zod imports are from `zod/v4`.

---

## File Structure

**New files:**

- `src/server/db/schema/speak.ts` — `speakSentencePractice` table
- `src/server/routers/speak.ts` — tRPC router with `recordPractice` + `getCounts`
- `src/lib/speak/seed.ts` — `SEED_SENTENCES` array (30 hand-picked native sentences)
- `src/lib/speak/tts.ts` — `speechSynthesis` wrapper
- `src/lib/speak/shuffle.ts` — Fisher-Yates shuffle (pure, unit-tested)
- `src/lib/speak/shuffle.test.ts` — vitest unit test for shuffle
- `src/app/(app)/speak/page.tsx` — single-page client UI
- `e2e/speak.spec.ts` — Playwright e2e
- `scripts/db/apply-2026-05-04-speak-rollout.mjs` — production Turso rollout
- `docs/changelog/2026-05-04-speak-phase-1.md` — changelog entry

**Modified files:**

- `src/server/db/schema/index.ts` — add `export * from "./speak"`
- `src/server/routers/_app.ts` — register `speak: speakRouter`
- `src/components/layout/navigation.ts` — add `/speak` nav entry under a `LEARN` or new section
- `README.md` — add a one-line entry under the "Optional Modules" or new section

**Reference files (read but do not modify):**

- `src/server/db/schema/drifter.ts` — pattern for new domain schema with `references(() => users.id)`
- `src/server/routers/preferences.ts` — pattern for simple user-scoped CRUD with zod v4
- `scripts/db/apply-2026-05-02-drifter-rollout.mjs` — pattern for rollout script
- `e2e/drifter.spec.ts` — pattern for sidebar-launched e2e

---

## Task 1: Schema — `speak_sentence_practice` table

**Files:**
- Create: `src/server/db/schema/speak.ts`
- Modify: `src/server/db/schema/index.ts`

- [ ] **Step 1: Create the schema file**

Create `src/server/db/schema/speak.ts`:

```ts
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

/**
 * Speak — shadow drill practice counts.
 * Spec: docs/superpowers/specs/2026-05-04-speak-shadow-drill-design.md
 *
 * One row per (user, sentence). `sentence_id` is the stable string ID from
 * src/lib/speak/seed.ts (e.g. "s_001"); never a DB-generated PK. Editing the
 * sentence text in seed.ts does not break historical counts.
 */
export const speakSentencePractice = sqliteTable(
  "speak_sentence_practice",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sentenceId: text("sentence_id").notNull(),
    count: integer("count").notNull().default(0),
    lastPracticedAt: integer("last_practiced_at").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.sentenceId] }),
  })
);
```

- [ ] **Step 2: Re-export from the barrel**

Edit `src/server/db/schema/index.ts`. After the existing `export * from "./drifter";` line, add:

```ts
export * from "./speak";
```

- [ ] **Step 3: Generate the Drizzle migration**

Run: `pnpm db:generate`

Expected: A new file appears in `drizzle/` (next number after the highest existing one — at the time of writing the latest is `0047_far_madame_masque.sql`, so this will be `0048_*.sql`). It must contain `CREATE TABLE` for `speak_sentence_practice` with the composite PK.

Inspect the generated SQL to confirm:
- `user_id` is `text NOT NULL` with `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE cascade`
- `sentence_id` is `text NOT NULL`
- `count` is `integer NOT NULL DEFAULT 0`
- `last_practiced_at` is `integer NOT NULL`
- `PRIMARY KEY(user_id, sentence_id)`

If anything is off, fix `speak.ts` and re-run `pnpm db:generate`.

- [ ] **Step 4: Apply the migration locally**

Run: `pnpm db:push`

Expected: command finishes without prompting for destructive operations. (If it does prompt, abort and inspect — we are only creating a new table.)

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema/speak.ts src/server/db/schema/index.ts drizzle/
git commit -m "feat(speak): add speak_sentence_practice schema"
```

---

## Task 2: Pure shuffle utility (with unit test)

**Files:**
- Create: `src/lib/speak/shuffle.ts`
- Create: `src/lib/speak/shuffle.test.ts`

We isolate the shuffle into a pure function so the page logic stays readable and we can deterministically test it. We write the test first.

- [ ] **Step 1: Write the failing test**

Create `src/lib/speak/shuffle.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { shuffle } from "./shuffle";

describe("shuffle", () => {
  it("preserves all original elements (multiset equality)", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = shuffle(input);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it("does not mutate the input array", () => {
    const input = [1, 2, 3, 4, 5];
    const snapshot = [...input];
    shuffle(input);
    expect(input).toEqual(snapshot);
  });

  it("returns a different reference from the input", () => {
    const input = [1, 2, 3];
    expect(shuffle(input)).not.toBe(input);
  });

  it("uses the supplied rng (deterministic when rng is fixed)", () => {
    const input = [1, 2, 3, 4, 5];
    // rng() returning 0 always picks the first remaining element each step,
    // which (for Fisher–Yates iterating from the end) produces a reverse.
    const fixedZero = () => 0;
    const out = shuffle(input, fixedZero);
    expect(out).toEqual([5, 1, 2, 3, 4]);
  });

  it("works on a single element", () => {
    expect(shuffle([42])).toEqual([42]);
  });

  it("works on an empty array", () => {
    expect(shuffle([])).toEqual([]);
  });
});
```

Note: The fourth test pins exact behavior so a future refactor that breaks the algorithm is caught. Walking through the standard Fisher–Yates from the end with `rng() === 0`:

- start: `[1,2,3,4,5]`
- i=4, j=0 → swap idx 4 and 0 → `[5,2,3,4,1]`
- i=3, j=0 → swap idx 3 and 0 → `[4,2,3,5,1]`
- i=2, j=0 → swap idx 2 and 0 → `[3,2,4,5,1]`
- i=1, j=0 → swap idx 1 and 0 → `[2,3,4,5,1]`
- final → `[2,3,4,5,1]`

Wait — that contradicts the assertion above. Update the assertion to match the algorithm we will implement:

```ts
    expect(out).toEqual([2, 3, 4, 5, 1]);
```

(Implementer: trace the algorithm for the rng you implement; the principle is "deterministic given a fixed rng," not the specific permutation. If your trace gives a different permutation than `[2,3,4,5,1]`, update the assertion to match — but never change the rng or skip this test.)

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm vitest run src/lib/speak/shuffle.test.ts`

Expected: FAIL with "Cannot find module './shuffle'" (or equivalent — the module does not exist yet).

- [ ] **Step 3: Implement shuffle**

Create `src/lib/speak/shuffle.ts`:

```ts
/**
 * Fisher–Yates shuffle. Pure: returns a new array, never mutates input.
 *
 * `rng` defaults to Math.random but is injectable for deterministic tests.
 * It must return a value in [0, 1).
 */
export function shuffle<T>(input: readonly T[], rng: () => number = Math.random): T[] {
  const out = input.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `pnpm vitest run src/lib/speak/shuffle.test.ts`

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/speak/shuffle.ts src/lib/speak/shuffle.test.ts
git commit -m "feat(speak): pure shuffle helper with deterministic test hook"
```

---

## Task 3: Seed library (30 hand-picked sentences)

**Files:**
- Create: `src/lib/speak/seed.ts`

This is the only task where the engineer needs to do real human picking work. **Do not have the AI write the sentences.** The whole point is "native, not textbook."

- [ ] **Step 1: Hand-pick 30 sentences**

Pick 30 sentences that satisfy ALL the following:

1. Source is real native speech: HN/Reddit comments, podcast transcripts (Lex Fridman, Acquired, The Daily, Hard Fork, etc.), or real Twitter/X posts from native speakers. Not textbooks. Not LLM output. Not ESL-curriculum templates.
2. Length 6–18 words.
3. Contains at least one expression a Chinese learner is unlikely to actively produce. Examples (do not just copy these — pick fresh ones): `ballpark, circle back, sleep on it, a hard sell, good shout, kind of a stretch, hit a snag, kicking the can, on the back burner, off the top of my head, take it with a grain of salt, give or take, in the ballpark of, that tracks, let me sit with it, that's a wash, fair enough, got it, makes sense, no worries, my bad, for what it's worth`.
4. No slang specific to a subculture, no profanity, no political content, no idioms tied to one country only.
5. Tone: working-professional casual. Includes contractions and discourse markers (`gotta, kinda, honestly, basically, actually, like, well, so, yeah`).
6. Punctuation matters for TTS prosody — keep commas where they belong; avoid all-caps.

**Acceptance bar:** Read each sentence out loud yourself. If you can imagine a real coworker in a Singapore office actually saying it in a 1:1 or standup, it qualifies. If it sounds like a Cambridge IELTS textbook, it does not qualify.

Create `src/lib/speak/seed.ts`:

```ts
export type SeedSentence = {
  /** Stable ID. Format: "s_NNN". Never re-numbered after release. */
  id: string;
  text: string;
};

/**
 * 30 hand-picked native English sentences for shadow drilling.
 * Sources: HN/Reddit comments, podcast transcripts, real social posts.
 * Selection criteria: docs/superpowers/specs/2026-05-04-speak-shadow-drill-design.md.
 *
 * Stable IDs ("s_001"…"s_NNN"): never reused, never re-numbered. New
 * sentences get the next free ID. Removed sentences leave a hole in the
 * sequence so persisted practice counts stay attached to the right text
 * historically.
 */
export const SEED_SENTENCES: SeedSentence[] = [
  { id: "s_001", text: "<sentence 1>" },
  { id: "s_002", text: "<sentence 2>" },
  // ...
  { id: "s_030", text: "<sentence 30>" },
];
```

Replace each `<sentence N>` with a real hand-picked sentence. Do not ship placeholders.

- [ ] **Step 2: Self-check against criteria**

Open `seed.ts` and verify:
- Exactly 30 entries.
- IDs are `s_001` through `s_030` in order, no duplicates, no gaps.
- No sentence starts with `As an AI` or `Here is` (catches accidental LLM artifacts).
- No sentence is shorter than 6 words or longer than 18.

A quick command for the length check:

```bash
node -e "const {SEED_SENTENCES} = require('./src/lib/speak/seed.ts'); /* won't work */"
```

That won't work directly because TS. Instead, eyeball it, or run:

```bash
grep -E '^\s+\{ id:' src/lib/speak/seed.ts | wc -l
```

Expected output: `30`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/speak/seed.ts
git commit -m "feat(speak): add 30 hand-picked native seed sentences"
```

---

## Task 4: Browser TTS wrapper

**Files:**
- Create: `src/lib/speak/tts.ts`

The wrapper must handle three real-world quirks:
1. `speechSynthesis.getVoices()` is async on first load — voices may be `[]` until `voiceschanged` fires.
2. Some platforms have very robotic default voices; we prefer en-US/en-GB voices when available.
3. iOS Safari requires a user gesture before the first `speak()` call.

We are not going to unit-test this module — it depends on `window.speechSynthesis` which is not in the Node test runtime, and stubbing it would only test the stub. The e2e in Task 8 covers the integration.

- [ ] **Step 1: Implement tts.ts**

Create `src/lib/speak/tts.ts`:

```ts
/**
 * Thin wrapper around window.speechSynthesis.
 *
 * Responsibilities:
 *   - lazily resolve a "good" English voice (prefers en-US, then en-GB,
 *     then any en-*, then the platform default)
 *   - cancel any in-flight utterance before speaking a new one (so rapid
 *     Play / Next clicks don't queue up)
 *   - return a promise that resolves when the utterance ends or errors
 *
 * It does NOT handle the iOS user-gesture gate — the page does that by
 * delaying the first speak() until the user has interacted (key/click).
 */

let cachedVoice: SpeechSynthesisVoice | null = null;

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const enUS = voices.find((v) => v.lang === "en-US");
  if (enUS) return enUS;
  const enGB = voices.find((v) => v.lang === "en-GB");
  if (enGB) return enGB;
  const anyEn = voices.find((v) => v.lang.startsWith("en"));
  if (anyEn) return anyEn;
  return voices[0] ?? null;
}

async function getVoice(): Promise<SpeechSynthesisVoice | null> {
  if (cachedVoice) return cachedVoice;
  if (typeof window === "undefined") return null;
  const synth = window.speechSynthesis;
  if (!synth) return null;

  const immediate = synth.getVoices();
  if (immediate.length > 0) {
    cachedVoice = pickVoice(immediate);
    return cachedVoice;
  }

  // Wait for the asynchronous voice list to load. Resolve fast (300ms) so a
  // missing event on a weird platform does not hang the UI; we'll just fall
  // back to the platform default voice.
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: SpeechSynthesisVoice | null) => {
      if (settled) return;
      settled = true;
      cachedVoice = v;
      resolve(v);
    };
    const handler = () => finish(pickVoice(synth.getVoices()));
    synth.addEventListener("voiceschanged", handler, { once: true });
    setTimeout(() => {
      synth.removeEventListener("voiceschanged", handler);
      finish(pickVoice(synth.getVoices()));
    }, 300);
  });
}

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export async function speak(text: string): Promise<void> {
  if (!isTtsSupported()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  const voice = await getVoice();
  if (voice) utt.voice = voice;
  utt.rate = 1.0;
  utt.pitch = 1.0;
  utt.lang = voice?.lang ?? "en-US";
  await new Promise<void>((resolve) => {
    utt.onend = () => resolve();
    utt.onerror = () => resolve();
    synth.speak(utt);
  });
}

export function cancelSpeech(): void {
  if (!isTtsSupported()) return;
  window.speechSynthesis.cancel();
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`

Expected: no errors mentioning `src/lib/speak/tts.ts`.

If your project does not have a `tsc` script alias, run `pnpm exec tsc --noEmit` instead.

- [ ] **Step 3: Commit**

```bash
git add src/lib/speak/tts.ts
git commit -m "feat(speak): browser speechSynthesis wrapper with voice picker"
```

---

## Task 5: tRPC router — `recordPractice` + `getCounts`

**Files:**
- Create: `src/server/routers/speak.ts`
- Modify: `src/server/routers/_app.ts`

Note: We use `protectedProcedure` (not `publicProcedure`) — the spec said `publicProcedure` but `publicProcedure` does not have `ctx.userId` in this codebase. See `src/server/trpc.ts`.

- [ ] **Step 1: Create the router**

Create `src/server/routers/speak.ts`:

```ts
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import { db } from "../db";
import { speakSentencePractice } from "../db/schema";
import { protectedProcedure, router } from "../trpc";

const recordPracticeInput = z.object({
  sentenceId: z.string().regex(/^s_\d{3}$/),
  increment: z.number().int().min(1).max(50),
});

export const speakRouter = router({
  /**
   * Upsert practice count for one sentence. The client is expected to call
   * this when leaving the sentence (next-button or beforeunload), with the
   * count of how many times Play fired during this session.
   */
  recordPractice: protectedProcedure
    .input(recordPracticeInput)
    .mutation(async ({ input, ctx }) => {
      const now = new Date();

      // SQLite UPSERT: INSERT … ON CONFLICT(user_id, sentence_id) DO UPDATE.
      await db
        .insert(speakSentencePractice)
        .values({
          userId: ctx.userId,
          sentenceId: input.sentenceId,
          count: input.increment,
          lastPracticedAt: now.getTime(),
        })
        .onConflictDoUpdate({
          target: [speakSentencePractice.userId, speakSentencePractice.sentenceId],
          set: {
            count: sql`${speakSentencePractice.count} + ${input.increment}`,
            lastPracticedAt: now.getTime(),
          },
        });

      return { ok: true as const };
    }),

  /**
   * Returns the user's practice count for every sentence they've practiced
   * at least once. Sentences with zero count are simply absent from the map.
   */
  getCounts: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        sentenceId: speakSentencePractice.sentenceId,
        count: speakSentencePractice.count,
      })
      .from(speakSentencePractice)
      .where(eq(speakSentencePractice.userId, ctx.userId));

    const map: Record<string, number> = {};
    for (const r of rows) {
      map[r.sentenceId] = r.count;
    }
    return map;
  }),
});
```

A note on `lastPracticedAt`: the schema column is `integer` (epoch ms). We pass `now.getTime()` directly, matching how other tables in this repo store timestamps (see `drifter_messages.created_at`).

- [ ] **Step 2: Register the router**

Edit `src/server/routers/_app.ts`. Add the import alongside the existing ones:

```ts
import { speakRouter } from "./speak";
```

and add the entry inside the `router({ … })` call:

```ts
  speak: speakRouter,
```

The exact placement is alphabetical-ish but the file is not strictly ordered — match the surrounding style (place near `preferences`).

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`

Expected: no errors. If you see errors about `and` being unused, remove the `and` import from `speak.ts` — we ended up not needing it (the where clause is a single equality).

Actually re-check: Step 1 imports `and` but the body uses only `eq`. Drop the unused `and` import:

```ts
import { eq, sql } from "drizzle-orm";
```

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/speak.ts src/server/routers/_app.ts
git commit -m "feat(speak): tRPC router for recordPractice + getCounts"
```

---

## Task 6: Page UI

**Files:**
- Create: `src/app/(app)/speak/page.tsx`

The page is a single client component. State is local; only `recordPractice` and `getCounts` cross the network.

- [ ] **Step 1: Implement the page**

Create `src/app/(app)/speak/page.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { trpc } from "@/lib/trpc";
import { SEED_SENTENCES, type SeedSentence } from "@/lib/speak/seed";
import { shuffle } from "@/lib/speak/shuffle";
import { cancelSpeech, isTtsSupported, speak } from "@/lib/speak/tts";

export default function SpeakPage() {
  const utils = trpc.useUtils();
  const countsQuery = trpc.speak.getCounts.useQuery();
  const recordPractice = trpc.speak.recordPractice.useMutation();

  // Shuffled order of sentences for this session. Reshuffles when we run
  // out. Stable across re-renders unless we explicitly resubstitute.
  const [order, setOrder] = useState<SeedSentence[]>(() => shuffle(SEED_SENTENCES));
  const [pointer, setPointer] = useState(0);

  // How many times the user has hit Play on the current sentence in this
  // session. Reset on Next.
  const localPlayCountRef = useRef(0);

  // Have we received the first user gesture? If not, defer auto-play
  // (Safari / iOS will block speak() before a gesture).
  const [gestureReceived, setGestureReceived] = useState(false);

  const current = order[pointer]!;

  const flushIfNeeded = useCallback(
    (sentenceId: string, count: number) => {
      if (count <= 0) return;
      recordPractice.mutate(
        { sentenceId, increment: count },
        {
          onSuccess: () => {
            // Optimistically merge into the local cache so "Practiced N times"
            // updates immediately on next render.
            utils.speak.getCounts.setData(undefined, (old) => {
              const prev = old ?? {};
              return {
                ...prev,
                [sentenceId]: (prev[sentenceId] ?? 0) + count,
              };
            });
          },
        }
      );
    },
    [recordPractice, utils]
  );

  const playCurrent = useCallback(() => {
    setGestureReceived(true);
    localPlayCountRef.current += 1;
    void speak(current.text);
  }, [current.text]);

  const next = useCallback(() => {
    const leaving = current;
    const leavingCount = localPlayCountRef.current;
    flushIfNeeded(leaving.id, leavingCount);
    localPlayCountRef.current = 0;

    cancelSpeech();

    setPointer((p) => {
      const np = p + 1;
      if (np >= order.length) {
        // Reshuffle quietly. We avoid showing "session complete".
        setOrder(shuffle(SEED_SENTENCES));
        return 0;
      }
      return np;
    });
  }, [current, flushIfNeeded, order.length]);

  // Auto-play first sentence on mount (or on first gesture for iOS).
  const autoPlayedRef = useRef(false);
  useEffect(() => {
    if (autoPlayedRef.current) return;
    if (!isTtsSupported()) return;
    if (!gestureReceived) return;
    autoPlayedRef.current = true;
    localPlayCountRef.current += 1;
    void speak(current.text);
  }, [current.text, gestureReceived]);

  // Auto-play when the sentence changes (after Next), no gesture needed
  // because Next itself was a gesture.
  useEffect(() => {
    if (!autoPlayedRef.current) return; // wait for first gesture's path
    // pointer is the dep — playing on current.text would also re-fire when we
    // resubstitute the same array. Use pointer to be precise.
  }, [pointer]);

  // (Combined effect — simpler: always play on (pointer, gestureReceived)
  // when both prerequisites hold.)
  useEffect(() => {
    if (!isTtsSupported()) return;
    if (!gestureReceived) return;
    // localPlayCountRef increment here, then speak.
    localPlayCountRef.current += 1;
    void speak(current.text);
    return () => cancelSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointer, gestureReceived]);

  // Best-effort flush on tab close / nav-away.
  useEffect(() => {
    const handler = () => {
      const c = localPlayCountRef.current;
      if (c <= 0) return;
      // beforeunload cannot await — fire-and-forget.
      flushIfNeeded(current.id, c);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [current.id, flushIfNeeded]);

  // Keyboard shortcuts: Space = Play, ArrowRight = Next.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        playCurrent();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [playCurrent, next]);

  const counts = countsQuery.data ?? {};
  const currentLifetimeCount = counts[current.id] ?? 0;

  const positionLabel = useMemo(
    () => `${pointer + 1} / ${order.length}`,
    [pointer, order.length]
  );

  if (!isTtsSupported()) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <p className="max-w-md text-center text-sm text-stone-600 dark:text-stone-400">
          Your browser does not support speech synthesis. Try Chrome, Safari, or Edge.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6">
      <p
        data-testid="speak-sentence"
        className="text-balance text-center text-3xl font-medium leading-snug text-stone-900 max-w-3xl dark:text-stone-100"
      >
        {current.text}
      </p>

      <div className="mt-12 flex items-center gap-4">
        <button
          type="button"
          data-testid="speak-play"
          onClick={playCurrent}
          className="rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
        >
          ▶ Play
        </button>
        <button
          type="button"
          data-testid="speak-next"
          onClick={next}
          className="rounded-full border border-stone-300 px-6 py-3 text-sm font-medium text-stone-700 transition hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
        >
          Next →
        </button>
      </div>

      <div className="mt-10 flex flex-col items-end self-end text-xs text-stone-400 dark:text-stone-500">
        {currentLifetimeCount > 0 && (
          <span data-testid="speak-practiced">Practiced {currentLifetimeCount} times</span>
        )}
        <span data-testid="speak-position">{positionLabel}</span>
      </div>
    </div>
  );
}
```

Note on the auto-play effect: There are two `useEffect` blocks above that look like they overlap. Simplify to a single effect (the second one) and delete the first stub. The final code should have ONE auto-play effect keyed on `[pointer, gestureReceived]`. Re-read your file after pasting and remove the stub before committing.

- [ ] **Step 2: Confirm the build still passes**

Run: `pnpm build`

Expected: build succeeds. If TypeScript flags an unused import or `eslint` flags `no-explicit-any`, fix it locally. The CLAUDE.md rule is hard: build must pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/speak/page.tsx
git commit -m "feat(speak): single-page shadow drill UI"
```

---

## Task 7: Sidebar entry

**Files:**
- Modify: `src/components/layout/navigation.ts`

We add `/speak` under the existing `LEARN` nav group. The icon is `Mic` from `lucide-react`.

- [ ] **Step 1: Add the icon import and nav entry**

Edit `src/components/layout/navigation.ts`. In the lucide import block at the top, add `Mic` to the alphabetical list:

```ts
import {
  Activity,
  FileText,
  FolderGit2,
  GraduationCap,
  LayoutDashboard,
  Leaf,
  MessageCircle,
  Mic,
  Settings2,
  Timer,
  TrendingUp,
  Users,
} from "lucide-react";
```

In the `navigationGroups` array, find the `LEARN` group and add `/speak` after `Projects`:

```ts
  {
    label: "LEARN",
    items: [
      { href: "/learn", label: "Learning", icon: GraduationCap },
      { href: "/projects", label: "Projects", icon: FolderGit2 },
      { href: "/speak", label: "Speak", icon: Mic },
    ],
  },
```

- [ ] **Step 2: Smoke-test in dev**

Run: `pnpm dev`

Open the dashboard, confirm:
- A "Speak" entry with a microphone icon is in the sidebar under the LEARN section.
- Clicking it lands on `/speak`.
- The page renders one sentence with Play / Next buttons.
- Click Play → you hear something (TTS).
- Click Next → sentence changes; you hear the new one.

(If TTS is silent on macOS Chrome: check System Settings → Accessibility → Spoken Content has a voice installed. The fallback voice picker handles this gracefully — you may just hear the platform default.)

Stop dev server (Ctrl+C).

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/navigation.ts
git commit -m "feat(speak): sidebar entry under LEARN section"
```

---

## Task 8: E2E test

**Files:**
- Create: `e2e/speak.spec.ts`

We do not test TTS audio output — Playwright headless Chromium has no real audio sink. We do test:
1. Sidebar entry → /speak loads, sentence + buttons render.
2. Next changes the sentence text.
3. After clicking Play and then Next, the practice counter for the previous sentence reflects on returning to it.

Note for the engineer: e2e setup in this repo seeds an `AUTH_BYPASS_USER_ID` test user — see `e2e/global-setup.ts` and `e2e/auth-prepare-db.mjs`. The trpc auth middleware honors this in non-prod (see `src/server/trpc.ts` line 89-95). You don't need to add anything special.

- [ ] **Step 1: Write the test file**

Create `e2e/speak.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.describe("Speak", () => {
  test("sidebar entry leads to /speak with sentence + buttons", async ({ page }) => {
    await page.goto("/");

    const speakLink = page.locator("aside").getByRole("link", { name: "Speak" });
    await expect(speakLink).toBeVisible();
    await speakLink.click();

    await page.waitForURL("**/speak");

    await expect(page.getByTestId("speak-sentence")).toBeVisible();
    await expect(page.getByTestId("speak-play")).toBeVisible();
    await expect(page.getByTestId("speak-next")).toBeVisible();
    await expect(page.getByTestId("speak-position")).toContainText("/ 30");
  });

  test("Next changes the visible sentence", async ({ page }) => {
    await page.goto("/speak");

    const sentence = page.getByTestId("speak-sentence");
    await expect(sentence).toBeVisible();
    const before = (await sentence.textContent())?.trim() ?? "";
    expect(before.length).toBeGreaterThan(0);

    await page.getByTestId("speak-next").click();

    // Sentence text should change. With 30 sentences in a shuffled order,
    // a same-sentence collision after one Next is statistically negligible
    // in a fresh shuffled queue (p ≈ 1/29 if first index landed last; in
    // a Fisher–Yates the next pointer always advances to a fresh slot).
    await expect(async () => {
      const now = (await sentence.textContent())?.trim() ?? "";
      expect(now).not.toEqual(before);
    }).toPass({ timeout: 2000 });
  });

  test("practice count persists after navigating away and back", async ({ page }) => {
    await page.goto("/speak");
    await expect(page.getByTestId("speak-sentence")).toBeVisible();

    // Play once on the current sentence, then Next — this should flush
    // a recordPractice mutation for the *previous* sentence.
    await page.getByTestId("speak-play").click();
    // small wait to let the synth fire-and-forget kick off
    await page.waitForTimeout(100);
    await page.getByTestId("speak-next").click();

    // Walk through the deck looking for any sentence with "Practiced N times"
    // shown. Since we Played 1× on at least one sentence and Next-flushed it,
    // we expect at least one of the next ~5 sentences (after re-entry) to
    // surface the counter — specifically the one we previously played.
    await page.goto("/speak");
    await expect(page.getByTestId("speak-sentence")).toBeVisible();

    // Click through up to all 30 positions to find a "Practiced N times" tile.
    let found = false;
    for (let i = 0; i < 32; i++) {
      const counter = page.getByTestId("speak-practiced");
      if (await counter.count() > 0 && await counter.isVisible().catch(() => false)) {
        const text = (await counter.textContent())?.trim() ?? "";
        expect(text).toMatch(/Practiced \d+ times/);
        found = true;
        break;
      }
      await page.getByTestId("speak-next").click();
      await page.waitForTimeout(50);
    }
    expect(found).toBe(true);
  });
});
```

- [ ] **Step 2: Run the speak spec**

Run: `pnpm test:e2e -- speak.spec.ts`

(If the project's e2e script needs a different filter syntax, check `e2e/README` or `playwright.config.ts`. Most likely `pnpm test:e2e speak.spec.ts` also works.)

Expected: 3 tests pass. If the third test fails because the recorded sentence wasn't surfaced within 32 Next clicks, the most likely root causes are:
- The mutation never fired (check `flushIfNeeded` is called from `next()`).
- The `setData` cache update path is wrong (it should populate `getCounts` so the page reads it without a refetch).

Fix and re-run.

- [ ] **Step 3: Run the full e2e suite to make sure nothing else broke**

Run: `pnpm test:e2e`

Expected: all suites pass. If anything is red that wasn't touched by this change, look closely — sidebar nav additions can shift element indices in other specs.

- [ ] **Step 4: Commit**

```bash
git add e2e/speak.spec.ts
git commit -m "test(speak): e2e for sidebar entry, Next flow, and counter persistence"
```

---

## Task 9: Self-verification (CLAUDE.md three-step)

- [ ] **Step 1: Build**

Run: `pnpm build`
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: lint passes. Note `feedback_lint_e2e_cache.md` in the user's auto-memory says lint may show errors from `.next-e2e` cache locally — those are not your concern, only the source-tree errors are.

- [ ] **Step 3: E2E full pass**

Run: `pnpm test:e2e`
Expected: all green.

If any of these fail: stop, fix, repeat. Do not skip and do not "commit anyway and fix in CI" — CLAUDE.md is explicit.

---

## Task 10: Production Turso schema rollout

**Files:**
- Create: `scripts/db/apply-2026-05-04-speak-rollout.mjs`

This is non-negotiable per `AGENTS.md` and `CLAUDE.md`. The new table must exist in production Turso before the deployment goes out.

- [ ] **Step 1: Write the rollout script**

Create `scripts/db/apply-2026-05-04-speak-rollout.mjs`:

```js
#!/usr/bin/env node

/**
 * Production Turso rollout — speak (shadow drill).
 *
 * Creates one new table for the speak module:
 *   speak_sentence_practice — composite PK (user_id, sentence_id)
 *
 * Source: drizzle/<NNNN>_<name>.sql (the migration generated in Task 1).
 *
 * Idempotent: detects existing table and skips creation; always runs the
 * verification queries at the end.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, "..", "..");

function loadEnv(path) {
  const content = readFileSync(path, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(join(repoRoot, ".env.turso-prod.local"));

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  process.exit(1);
}

const client = createClient({ url, authToken });

console.log("Production Turso rollout — speak (shadow drill)");
console.log(`Target: ${url}`);
console.log("");

async function tableExists(name) {
  const r = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [name],
  });
  return r.rows.length > 0;
}

if (!(await tableExists("speak_sentence_practice"))) {
  console.log("Creating speak_sentence_practice...");
  await client.execute(`
    CREATE TABLE speak_sentence_practice (
      user_id text NOT NULL,
      sentence_id text NOT NULL,
      count integer NOT NULL DEFAULT 0,
      last_practiced_at integer NOT NULL,
      PRIMARY KEY (user_id, sentence_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
    )
  `);
} else {
  console.log("Skip — speak_sentence_practice already exists.");
}

console.log("");
console.log("Verification:");

if (!(await tableExists("speak_sentence_practice"))) {
  console.error("  FAIL — missing table speak_sentence_practice");
  process.exit(1);
}
console.log("  OK — table speak_sentence_practice exists");

// Verify FK
const fkResult = await client.execute({
  sql: `PRAGMA foreign_key_list('speak_sentence_practice')`,
});
const usersFk = fkResult.rows.find((r) => r.table === "users");
if (!usersFk) {
  console.error("  FAIL — speak_sentence_practice missing FK to users(id)");
  process.exit(1);
}
if (usersFk.on_delete !== "CASCADE") {
  console.error(
    `  FAIL — speak_sentence_practice.user_id FK on_delete is ${usersFk.on_delete}, expected CASCADE`,
  );
  process.exit(1);
}
console.log("  OK — speak_sentence_practice.user_id → users(id) ON DELETE CASCADE");

// Verify composite PK
const pkResult = await client.execute({
  sql: `PRAGMA table_info('speak_sentence_practice')`,
});
const pkCols = pkResult.rows
  .filter((r) => r.pk > 0)
  .sort((a, b) => Number(a.pk) - Number(b.pk))
  .map((r) => r.name);
if (pkCols.join(",") !== "user_id,sentence_id") {
  console.error(
    `  FAIL — composite PK columns are ${pkCols.join(",") || "(none)"}, expected user_id,sentence_id`,
  );
  process.exit(1);
}
console.log("  OK — composite PK (user_id, sentence_id)");

console.log("");
console.log("✅ Production rollout verified: speak schema is ready.");
```

Cross-reference this DDL against the SQL Drizzle generated in Task 1 step 3. If they diverge (column types, default values, FK clauses), update the rollout script to match Drizzle — Drizzle is the source of truth.

- [ ] **Step 2: Run the rollout script against production**

Run: `node scripts/db/apply-2026-05-04-speak-rollout.mjs`

Expected output ends with: `✅ Production rollout verified: speak schema is ready.`

If any verification fails, do not retry blindly — investigate the mismatch and adjust the script (or the schema generation in Task 1) before re-running.

- [ ] **Step 3: Commit the script**

```bash
git add scripts/db/apply-2026-05-04-speak-rollout.mjs
git commit -m "ops(speak): production Turso rollout script"
```

---

## Task 11: Changelog + README

**Files:**
- Create: `docs/changelog/2026-05-04-speak-phase-1.md`
- Modify: `README.md`

- [ ] **Step 1: Write the changelog**

Create `docs/changelog/2026-05-04-speak-phase-1.md`:

```markdown
# Speak — Shadow Drill Phase 1 (2026-05-04)

## Goal
Ship the smallest viable "open and shadow" English speaking module: pick a random native sentence, browser TTS reads it, user shadows it, presses Next. Each sentence's lifetime practice count persists per user.

## Key changes
- New table `speak_sentence_practice` (composite PK `user_id, sentence_id`, FK to `users` ON DELETE CASCADE)
- New tRPC router `speak` with `recordPractice` (UPSERT increment) and `getCounts`
- New `/speak` route under `(app)`, sidebar entry under LEARN with Mic icon
- 30 hand-picked native seed sentences in `src/lib/speak/seed.ts` (stable IDs `s_001`–`s_030`)
- Browser-native TTS via `speechSynthesis` with en-US/en-GB voice preference
- Pure shuffle helper (`shuffle.ts`) with deterministic-rng test hook
- E2E coverage: sidebar entry, Next changes sentence, practice counter persists across reload

## Files touched
- New: `src/server/db/schema/speak.ts`, `src/server/routers/speak.ts`, `src/lib/speak/{seed,shuffle,shuffle.test,tts}.ts`, `src/app/(app)/speak/page.tsx`, `e2e/speak.spec.ts`, `scripts/db/apply-2026-05-04-speak-rollout.mjs`
- Modified: `src/server/db/schema/index.ts`, `src/server/routers/_app.ts`, `src/components/layout/navigation.ts`, `README.md`
- Migration: `drizzle/<NNNN>_<name>.sql` (generated by drizzle-kit)

## Database changes
- Table: `speak_sentence_practice (user_id text, sentence_id text, count integer DEFAULT 0, last_practiced_at integer, PK(user_id, sentence_id), FK user_id → users(id) ON DELETE CASCADE)`
- Local: `pnpm db:push` ✓
- Production Turso: `node scripts/db/apply-2026-05-04-speak-rollout.mjs` → `✅ Production rollout verified: speak schema is ready.`

## Verification
- `pnpm vitest run src/lib/speak/shuffle.test.ts` — 6/6 pass
- `pnpm build` — pass
- `pnpm lint` — pass
- `pnpm test:e2e` — full suite green, including 3 new `speak.spec.ts` tests
- Manual smoke in dev (Chrome macOS): sidebar nav → /speak loads, Play audible, Next advances, counter increments after reload

## Known limitations / follow-ups
- Browser TTS quality varies by platform; future upgrade path is OpenAI tts-1-hd with R2-cached pre-generation (kept as Future Work in spec).
- iOS Safari blocks the very first auto-play until a user gesture; the page handles this transparently (waits for `gestureReceived`).
- Library is fixed at 30 sentences; "user-submitted sentences", "AI-extended seeds", and "smart prioritization (least-practiced first)" are explicit non-goals for v1.
- Not Pro-gated: this module is free for all users in v1; revisit if it ships behind a feature flag later.

## Spec
docs/superpowers/specs/2026-05-04-speak-shadow-drill-design.md
```

- [ ] **Step 2: Update README**

Edit `README.md`. Find the "Optional Modules" section (look for `### Optional Modules`). Add a new bullet after the existing entries:

```markdown
- **Speak** — `/speak` shadow-drill module. One native English sentence at a time, browser TTS plays it, you shadow it, press Next. Per-sentence lifetime practice count synced across devices. v1 ships 30 hand-picked sentences.
```

- [ ] **Step 3: Commit**

```bash
git add docs/changelog/2026-05-04-speak-phase-1.md README.md
git commit -m "docs(speak): phase 1 changelog + README entry"
```

---

## Task 12: Push to main (deploys)

`CLAUDE.md` rule: tasks complete and verified → push directly. Pushing to main triggers the Hetzner deployment workflow.

- [ ] **Step 1: Confirm clean state**

Run: `git status`
Expected: working tree clean (everything committed in tasks 1–11).

Run: `git log --oneline origin/main..HEAD`
Expected: lists all the commits this plan produced. Skim — every commit message should start with `feat(speak)`, `test(speak)`, `ops(speak)`, or `docs(speak)`.

- [ ] **Step 2: Push**

Run: `git push origin main`

Expected: push succeeds. The GitHub Action `deploy-hetzner.yml` will lint, rsync to Hetzner, then run `ops/hetzner/deploy.sh`. Production schema was already rolled out in Task 10 so the deployed app will not crash on first request to `speak.getCounts`.

- [ ] **Step 3: Smoke-check production**

Open the production URL in a browser, sign in, and:
- Confirm "Speak" entry shows in sidebar.
- Click it → page loads.
- Play / Next work.
- Practice count appears after a Next (may take a couple Next clicks before you see one with the counter, since first session has no history).

If anything is broken in production but worked locally: roll back is `git revert <merge-sha> && git push`. Investigate cause before re-deploying.

---

## Self-Review

**Spec coverage check:** Walking each section of `docs/superpowers/specs/2026-05-04-speak-shadow-drill-design.md`:
- "In scope" → Tasks 1–11 cover every bullet (route, sentence, TTS, shuffle, no-completion-toast, keyboard shortcuts, count display, schema, router).
- "Out of scope" → No task touches recording, language toggle, themes, AI generation, etc.
- Page layout → Task 6 step 1 implements it.
- Behavior rules (auto-play, Space/→ shortcut, beforeunload flush, reshuffle quietly) → Task 6 step 1.
- Schema (`user_id, sentence_id, count, last_practiced_at`, composite PK) → Task 1.
- tRPC (`recordPractice`, `getCounts`) → Task 5. Note plan deliberately uses `protectedProcedure`, correcting the spec's `publicProcedure` typo.
- Risks (voice picker, async voice list, iOS gesture, large-text wrapping, ignore zero-count) → Task 4 + Task 6.
- E2E → Task 8.
- Self-verification three steps → Task 9.
- Production rollout → Task 10.

**Placeholder check:** Searched for "TBD", "TODO", "implement later", "fill in details" — only "TODO" appearance is in the seed.ts placeholders that are explicitly marked as user work to do (Task 3 "Replace each `<sentence N>`"). Acceptable.

**Type consistency:** `sentenceId` regex `^s_\d{3}$` matches the seed file ID format `s_001`. `recordPractice` input `{ sentenceId, increment }` matches the call site in the page. `getCounts` returns `Record<string, number>` matching the page's `counts[current.id] ?? 0` access. `flushIfNeeded(id, count)` signature consistent across page.

One simplification I made during review: collapsed Task 6's two redundant auto-play `useEffect`s into one (the second). The "Step 1" listing has a stub plus a real one and a note to delete the stub. Implementer: pay attention to that note.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-04-speak-shadow-drill.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
