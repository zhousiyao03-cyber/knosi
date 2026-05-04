# /words Pronunciation Drill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/words`, a single-page word-level pronunciation drill that pairs with `/speak`. Each card shows stress visualization, IPA, brief Chinese meaning, and one native example sentence; user shadows via two TTS buttons (Word / Sentence). Adds words via an in-page Add modal that calls AI to enrich on save.

**Architecture:** Single client page reads a 100-word hand-picked seed array (with AI-enriched 4 fields baked in) plus the user's own appended words from a `user_words` table. Random shuffle, browser TTS reused from `/speak`. New tRPC router with `addWord` (proProcedure → AI enrichment), `listWords`, `recordPractice`, `getCounts`. Practice counts persisted to `word_practice`.

**Tech Stack:** Next.js 16 App Router, React 19, tRPC v11 (`protectedProcedure` / `proProcedure`), Drizzle ORM + libsql/Turso, Tailwind v4, lucide-react `BookOpen`, Vercel AI SDK via project's `generateStructuredData` abstraction, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-05-04-words-pronunciation-drill-design.md`

**Repo conventions to follow:**

- IDs use `crypto.randomUUID()` (project standard — see `src/server/routers/bookmarks.ts:56`, `learning.ts:43`).
- AI calls go through `import { generateStructuredData } from "@/server/ai/provider"`. Signature is `(options, ctx)` where `options = { name, description, prompt, schema, signal? }` and `ctx = { userId, role? }`. There is **no `system` field** — embed instructions in `prompt`.
- All zod imports `from "zod/v4"`.
- Pro-gated AI mutations use `proProcedure` (matches drifter, focus AI, learning). Self-hosted gets `PRO_UNLIMITED` automatically.
- E2E mocks for AI use an env var convention like `DRIFTER_E2E_MOCK=1` — we'll add `WORDS_E2E_MOCK=1` to `playwright.config.ts`'s default project env.
- Drizzle table files live under `src/server/db/schema/<domain>.ts` and re-export through `index.ts`.
- TTS / shuffle helpers from `/speak` are reused as-is — no need to duplicate them.

**Important pre-read:** `AGENTS.md`, `CLAUDE.md`, `.claude/rules/api-pitfalls.md`, `.claude/rules/production-turso.md`, and the existing `/speak` files (`src/lib/speak/{seed,shuffle,tts}.ts`, `src/server/routers/speak.ts`, `src/app/(app)/speak/page.tsx`, `scripts/db/apply-2026-05-04-speak-rollout.mjs`) as the closest pattern reference.

---

## File Structure

**New files:**

- `src/server/db/schema/words.ts` — `userWords` + `wordPractice` tables
- `src/server/routers/words.ts` — tRPC router
- `src/server/ai/words.ts` — `enrichWord(text)` helper
- `src/lib/words/seed.ts` — `SEED_WORDS: SeedWord[]` (100 entries)
- `src/app/(app)/words/page.tsx` — page UI + Add modal
- `e2e/words.spec.ts` — Playwright e2e
- `scripts/db/apply-2026-05-04-words-rollout.mjs` — production Turso rollout
- `scripts/words/generate-seed-enrichment.mjs` — dev-time script to AI-enrich the 100 hand-picked words
- `docs/changelog/2026-05-04-words-phase-1.md` — changelog

**Modified files:**

- `src/server/db/schema/index.ts` — `export * from "./words"`
- `src/server/routers/_app.ts` — register `words: wordsRouter`
- `src/components/layout/navigation.ts` — `/words` LEARN entry
- `playwright.config.ts` — add `WORDS_E2E_MOCK=1` to default project's env
- `README.md` — entry under modules

---

## Task 1: Schema (`user_words` + `word_practice`)

**Files:**
- Create: `src/server/db/schema/words.ts`
- Modify: `src/server/db/schema/index.ts`

- [ ] **Step 1: Create the schema file**

Create `src/server/db/schema/words.ts`:

```ts
import { sqliteTable, text, integer, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

/**
 * Words — pronunciation drill module.
 * Spec: docs/superpowers/specs/2026-05-04-words-pronunciation-drill-design.md
 *
 * user_words holds words a user has appended themselves (with AI-enriched
 * 4 fields cached). Seed words live in src/lib/words/seed.ts and are NOT
 * stored here — they're fetched from the bundle on every page load.
 *
 * word_practice holds per-user practice counts for both seed words and
 * user-added words. word_id has no FK so it can hold both ID spaces:
 *   "w_001"…    seed words
 *   "uw_<uuid>" user_words.wordId
 */
export const userWords = sqliteTable(
  "user_words",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    wordId: text("word_id").notNull(),
    text: text("text").notNull(),
    textNormalized: text("text_normalized").notNull(),
    ipa: text("ipa").notNull(),
    stressPattern: text("stress_pattern").notNull(),
    meaningZh: text("meaning_zh").notNull(),
    exampleEn: text("example_en").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.wordId] }),
    uniqByText: uniqueIndex("user_words_user_text_idx").on(t.userId, t.textNormalized),
  })
);

export const wordPractice = sqliteTable(
  "word_practice",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    wordId: text("word_id").notNull(),
    count: integer("count").notNull().default(0),
    lastPracticedAt: integer("last_practiced_at").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.wordId] }),
  })
);
```

- [ ] **Step 2: Re-export from the barrel**

Edit `src/server/db/schema/index.ts`. After `export * from "./speak";` add:

```ts
export * from "./words";
```

- [ ] **Step 3: Generate Drizzle migration**

Run: `pnpm db:generate`

Inspect the new `drizzle/00NN_*.sql` file. Confirm:
- `CREATE TABLE user_words` with FK to users(id) ON DELETE cascade and PRIMARY KEY(user_id, word_id)
- `CREATE UNIQUE INDEX user_words_user_text_idx` on (user_id, text_normalized)
- `CREATE TABLE word_practice` with FK and PK as above

- [ ] **Step 4: Apply locally**

Run: `pnpm db:push`. Should not prompt.

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema/words.ts src/server/db/schema/index.ts drizzle/
git commit -m "feat(words): add user_words and word_practice schema"
```

---

## Task 2: AI enrichment helper

**Files:**
- Create: `src/server/ai/words.ts`

The helper is the only place that talks to the LLM. It returns a typed `WordEnrichment`. When `WORDS_E2E_MOCK=1` it returns deterministic fake data so e2e doesn't burn tokens.

- [ ] **Step 1: Implement the helper**

Create `src/server/ai/words.ts`:

```ts
import { z } from "zod/v4";

import { generateStructuredData } from "./provider";

export const wordEnrichmentSchema = z.object({
  ipa: z
    .string()
    .min(1)
    .max(80)
    .describe("IPA in slashes, e.g. /ɪˈpɪt.ə.mi/"),
  stressPattern: z
    .string()
    .min(1)
    .max(60)
    .describe(
      "Syllables joined by middle-dots ·, with the stressed syllable in ALL CAPS. Single-syllable words are entirely uppercase. Examples: 'e·PIT·o·me', 'pho·TOG·ra·phy', 'HOUSE'.",
    ),
  meaningZh: z
    .string()
    .min(1)
    .max(40)
    .describe(
      "Most common Chinese meaning, ≤ 12 hanzi total. One sense only — no semicolons, no parens, no part-of-speech labels.",
    ),
  exampleEn: z
    .string()
    .min(1)
    .max(220)
    .describe(
      "One natural-sounding example sentence using the word (or a closely related inflected form). 6-18 words. Working-professional casual register, contractions allowed. No textbook clichés.",
    ),
});

export type WordEnrichment = z.infer<typeof wordEnrichmentSchema>;

const ENRICHMENT_PROMPT = (text: string) => `You are enriching the English word "${text}" for a Chinese learner who already has reading comprehension but wants to practice pronunciation and active recall.

Return a JSON object with these four fields:

1. ipa — the General American IPA transcription wrapped in forward slashes. Example for "epitome": /ɪˈpɪt.ə.mi/

2. stressPattern — syllables separated by middle-dots (·), with the stressed syllable in ALL CAPS. Single-syllable words are fully uppercase. Examples:
   - "epitome" → "e·PIT·o·me"
   - "photography" → "pho·TOG·ra·phy"
   - "house" → "HOUSE"
   - "hierarchy" → "HI·er·ar·chy"

3. meaningZh — the most common Chinese meaning, ≤ 12 Chinese characters total. One sense only. No part-of-speech tags. No semicolons. No parens. Example:
   - "epitome" → "典型；缩影" (NO — has a semicolon, two senses)
   - "epitome" → "典型代表" (YES — one short sense)
   - "hierarchy" → "等级制度" (YES)

4. exampleEn — one natural-sounding example sentence using "${text}" (or a closely related inflected form). 6-18 words. Working-professional casual register. Contractions OK (gonna, kinda, gotta, that's, etc.). NO textbook clichés like "I want to improve my English." Examples for "epitome":
   - "She's the epitome of a calm-under-pressure engineer." (YES)
   - "The epitome is a important word." (NO — broken grammar, dictionary tone)

Be precise. Do not invent senses the word doesn't have. Do not add fields beyond these four.`;

export async function enrichWord(
  text: string,
  ctx: { userId: string },
): Promise<WordEnrichment> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("enrichWord: empty input");

  // E2E + dev short-circuit. Tests rely on this being deterministic.
  if (process.env.WORDS_E2E_MOCK === "1") {
    return {
      ipa: "/test/",
      stressPattern: trimmed.toUpperCase(),
      meaningZh: "测试词",
      exampleEn: `This is a test sentence with ${trimmed}.`,
    };
  }

  return generateStructuredData(
    {
      name: "word_enrichment",
      description:
        "Enrich an English word with IPA, stress pattern, brief Chinese meaning, and one natural example sentence.",
      prompt: ENRICHMENT_PROMPT(trimmed),
      schema: wordEnrichmentSchema,
    },
    { userId: ctx.userId },
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc --noEmit`

Expected: no errors mentioning `src/server/ai/words.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/server/ai/words.ts
git commit -m "feat(words): AI enrichment helper with E2E mock"
```

---

## Task 3: Seed enrichment script + `seed.ts`

**Files:**
- Create: `scripts/words/generate-seed-enrichment.mjs`
- Create: `src/lib/words/seed.ts`

This task is the only one where AI work happens at *dev* time. The script reads a hand-picked list of 100 words (defined inline in the script), calls `enrichWord` for each through the project's normal AI provider pipeline, and writes the result to `seed.ts`. The author then opens `seed.ts` and reviews/edits each entry by hand.

- [ ] **Step 1: Write the generation script**

Create `scripts/words/generate-seed-enrichment.mjs`:

```js
#!/usr/bin/env node

/**
 * One-off: enrich the hand-picked /words seed list via the project's AI
 * pipeline and write the result to src/lib/words/seed.ts. Run from the repo
 * root with the same .env that powers `pnpm dev`:
 *
 *   pnpm tsx scripts/words/generate-seed-enrichment.mjs > /tmp/words.json
 *
 * The script writes JSON to stdout; pipe it into seed.ts after a human
 * review pass. Do NOT trust the AI output verbatim — read each entry and
 * fix anything that smells like textbook English.
 */

import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const HAND_PICKED = [
  // 100 hand-picked words live here — see Task 3 Step 2.
];

async function main() {
  // Lazy import so dotenv loads before any module that reads env at top level.
  const { enrichWord } = await import("../../src/server/ai/words.ts");
  const out = [];
  for (let i = 0; i < HAND_PICKED.length; i++) {
    const word = HAND_PICKED[i];
    process.stderr.write(`[${i + 1}/${HAND_PICKED.length}] ${word}... `);
    try {
      const enriched = await enrichWord(word, { userId: "seed-script" });
      out.push({
        id: `w_${String(i + 1).padStart(3, "0")}`,
        text: word,
        ...enriched,
      });
      process.stderr.write("ok\n");
    } catch (err) {
      process.stderr.write(`FAIL: ${err.message}\n`);
    }
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Note for engineer: `import("../../src/server/ai/words.ts")` may need a `tsx` runtime since it's a `.ts` file. Run via `pnpm tsx scripts/words/generate-seed-enrichment.mjs`. The repo already uses `tsx` (see `scripts/seed-demo.ts`).

- [ ] **Step 2: Hand-pick 100 words inside the script**

In `HAND_PICKED`, list 100 English words that satisfy:
1. Native usage: things you'd actually hear in a working-professional setting (Singapore tech office, podcast, HN comments).
2. **At least one of**: tricky stress (`epitome, hierarchy, photography`), tricky vowel (`suite, queue, colonel`), silent letter (`subtle, debris, almond`), or just-rare-enough that a Chinese learner won't actively produce it (`facade, niche, rapport, ennui`).
3. NOT trivial-frequent (`apple, table, book` — user will be bored).
4. NOT obscure-jargon (`syzygy, defenestrate` — user won't actually use them).

Aim for a mix: ~30 stress-traps, ~25 vowel/silent traps, ~45 active-vocab uplift. Concrete starter list (you can add/replace freely up to 100):

```js
const HAND_PICKED = [
  // stress-traps
  "epitome", "hierarchy", "photography", "comparable", "applicable",
  "preferable", "admirable", "vehement", "exquisite", "irreparable",
  // silent letters / tricky vowels
  "colonel", "subtle", "almond", "debris", "rendezvous",
  "buffet", "depot", "epitome", "suite", "queue",
  // common but mispronounced
  "niche", "facade", "rapport", "genre", "cliche",
  "denouement", "ennui", "concierge", "lingerie", "entrepreneur",
  // active-vocab uplift (working-professional)
  "ballpark", "circle", "bandwidth", "leverage", "synergy",
  "stakeholder", "deliverable", "milestone", "cadence", "alignment",
  "rapport", "snag", "blocker", "context", "nuance",
  // hedge / discourse
  "honestly", "literally", "essentially", "particularly", "precisely",
  "conceivably", "presumably", "ostensibly", "inevitably", "arguably",
  // approval / disagreement
  "absolutely", "definitely", "obviously", "exactly", "rightly",
  "scarcely", "hardly", "barely", "surely", "rarely",
  // emotion / attitude
  "frustrating", "exhausting", "rewarding", "fulfilling", "compelling",
  "underwhelming", "overwhelming", "lukewarm", "tepid", "fervent",
  // verbs of working life
  "iterate", "validate", "deprecate", "delegate", "escalate",
  "circumvent", "navigate", "consolidate", "expedite", "prioritize",
  // misc actively-useful
  "verbatim", "bona", "fide", "caveat", "nuance",
  "anecdote", "anomaly", "paradigm", "precedent", "rationale",
];
```

(Keep exactly 100 unique entries. The starter above has duplicates — `epitome`, `rapport`, `nuance` — fix them. `bona fide` should be a single entry "bona fide" not split.)

- [ ] **Step 3: Run the script**

Make sure `.env.local` has whatever AI provider config you use locally (the same that lets `pnpm dev` chat with AI).

```bash
pnpm tsx scripts/words/generate-seed-enrichment.mjs > /tmp/words-enrichment.json
```

Expected: stderr shows `[1/100] epitome... ok`, etc. Stdout writes JSON.

If many entries fail or look low-quality, fix the prompt in `src/server/ai/words.ts` and re-run.

- [ ] **Step 4: Human-review the JSON**

Open `/tmp/words-enrichment.json` and read every entry. Fix:
- IPA missing slashes
- stressPattern that's just lower-case (model didn't follow the cap rule)
- meaningZh longer than 12 hanzi or with semicolons / parens / 词性 tags — trim
- exampleEn that sounds like a textbook ("I want to improve my English.") — rewrite it manually to match the `/speak` seed sentences vibe

Don't ship anything you'd be embarrassed to read aloud.

- [ ] **Step 5: Write `seed.ts`**

Create `src/lib/words/seed.ts`:

```ts
export type SeedWord = {
  id: string;             // stable, "w_NNN"
  text: string;
  ipa: string;
  stressPattern: string;
  meaningZh: string;
  exampleEn: string;
};

/**
 * 100 hand-picked words for /words. Process: a human picks the word list,
 * AI enriches IPA / stressPattern / meaningZh / exampleEn, the human reviews
 * every entry, and the final approved data is committed here.
 *
 * Stable IDs ("w_001"…"w_NNN"): never reused, never re-numbered.
 *
 * Source: scripts/words/generate-seed-enrichment.mjs run on YYYY-MM-DD.
 * Spec: docs/superpowers/specs/2026-05-04-words-pronunciation-drill-design.md
 */
export const SEED_WORDS: SeedWord[] = [
  { id: "w_001", text: "epitome", ipa: "/ɪˈpɪt.ə.mi/", stressPattern: "e·PIT·o·me", meaningZh: "典型代表", exampleEn: "She's the epitome of a calm-under-pressure engineer." },
  // … 99 more, paste from the reviewed JSON
];
```

- [ ] **Step 6: Sanity-check**

Run a quick word count and ID check:

```bash
node -e "
const fs = require('fs');
const src = fs.readFileSync('src/lib/words/seed.ts','utf8');
const re = /\\{ id: \"(w_\\d{3})\", text: \"([^\"]+)\"/g;
let m, items = [];
while ((m = re.exec(src))) items.push({ id: m[1], text: m[2] });
console.log('Total:', items.length);
const seen = new Set();
items.forEach((it,i) => {
  const expected = 'w_' + String(i+1).padStart(3,'0');
  if (it.id !== expected) console.log('ID mismatch at', i, it.id, 'vs', expected);
  if (seen.has(it.text.toLowerCase())) console.log('DUP text:', it.text);
  seen.add(it.text.toLowerCase());
});
console.log('Done.');
"
```

Expected: `Total: 100`, no mismatches, no DUPs.

- [ ] **Step 7: Commit**

```bash
git add scripts/words/generate-seed-enrichment.mjs src/lib/words/seed.ts
git commit -m "feat(words): 100 hand-picked seeds with AI-enriched fields"
```

---

## Task 4: tRPC `words` router

**Files:**
- Create: `src/server/routers/words.ts`
- Modify: `src/server/routers/_app.ts`

- [ ] **Step 1: Create the router**

Create `src/server/routers/words.ts`:

```ts
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import { enrichWord } from "../ai/words";
import { db } from "../db";
import { userWords, wordPractice } from "../db/schema";
import { proProcedure, protectedProcedure, router } from "../trpc";

const recordPracticeInput = z.object({
  // Seed: w_NNN. User-added: uw_<UUID>. UUID is hex+dashes, length 32-40.
  wordId: z.string().regex(/^(w_\d{3}|uw_[A-Za-z0-9-]+)$/),
  increment: z.number().int().min(1).max(50),
});

export const wordsRouter = router({
  /**
   * Append a user word. Pro-gated because it calls AI to enrich. The
   * (user_id, text_normalized) unique index also enforces dedupe at the DB
   * layer in case two concurrent calls slip past the SELECT below.
   */
  addWord: proProcedure
    .input(z.object({ text: z.string().trim().min(1).max(64) }))
    .mutation(async ({ input, ctx }) => {
      const normalized = input.text.toLowerCase();
      const existing = await db
        .select({ wordId: userWords.wordId })
        .from(userWords)
        .where(
          and(
            eq(userWords.userId, ctx.userId),
            eq(userWords.textNormalized, normalized),
          ),
        )
        .limit(1);
      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Already in your list",
        });
      }

      const enrichment = await enrichWord(input.text, { userId: ctx.userId });
      const wordId = `uw_${crypto.randomUUID()}`;
      const now = Date.now();

      await db.insert(userWords).values({
        userId: ctx.userId,
        wordId,
        text: input.text,
        textNormalized: normalized,
        ipa: enrichment.ipa,
        stressPattern: enrichment.stressPattern,
        meaningZh: enrichment.meaningZh,
        exampleEn: enrichment.exampleEn,
        createdAt: now,
      });

      return {
        id: wordId,
        text: input.text,
        ...enrichment,
        createdAt: now,
      };
    }),

  listWords: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        id: userWords.wordId,
        text: userWords.text,
        ipa: userWords.ipa,
        stressPattern: userWords.stressPattern,
        meaningZh: userWords.meaningZh,
        exampleEn: userWords.exampleEn,
        createdAt: userWords.createdAt,
      })
      .from(userWords)
      .where(eq(userWords.userId, ctx.userId))
      .orderBy(desc(userWords.createdAt));
    return rows;
  }),

  recordPractice: protectedProcedure
    .input(recordPracticeInput)
    .mutation(async ({ input, ctx }) => {
      const now = Date.now();
      await db
        .insert(wordPractice)
        .values({
          userId: ctx.userId,
          wordId: input.wordId,
          count: input.increment,
          lastPracticedAt: now,
        })
        .onConflictDoUpdate({
          target: [wordPractice.userId, wordPractice.wordId],
          set: {
            count: sql`${wordPractice.count} + ${input.increment}`,
            lastPracticedAt: now,
          },
        });
      return { ok: true as const };
    }),

  getCounts: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({ wordId: wordPractice.wordId, count: wordPractice.count })
      .from(wordPractice)
      .where(eq(wordPractice.userId, ctx.userId));
    const map: Record<string, number> = {};
    for (const r of rows) map[r.wordId] = r.count;
    return map;
  }),
});
```

- [ ] **Step 2: Register the router**

Edit `src/server/routers/_app.ts`. Add the import:

```ts
import { wordsRouter } from "./words";
```

Add to the `router({ … })` literal, near `speak: speakRouter`:

```ts
  words: wordsRouter,
```

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc --noEmit`. No errors in `routers/words.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/words.ts src/server/routers/_app.ts
git commit -m "feat(words): tRPC router (addWord proProcedure, list/record/counts)"
```

---

## Task 5: Page UI + Add modal

**Files:**
- Create: `src/app/(app)/words/page.tsx`

- [ ] **Step 1: Implement the page**

Create `src/app/(app)/words/page.tsx`:

```tsx
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { trpc } from "@/lib/trpc";
import { SEED_WORDS, type SeedWord } from "@/lib/words/seed";
import { shuffle } from "@/lib/speak/shuffle";
import { cancelSpeech, isTtsSupported, speak } from "@/lib/speak/tts";

type DeckEntry = SeedWord;  // user-added words have the same shape.

const subscribeNoop = () => () => {};
const getServerSnapshot = () => false;
const getClientSnapshot = () => true;
function useIsClient(): boolean {
  return useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);
}

export default function WordsPage() {
  const utils = trpc.useUtils();
  const isClient = useIsClient();

  const listWords = trpc.words.listWords.useQuery();
  const countsQuery = trpc.words.getCounts.useQuery();
  const recordPractice = trpc.words.recordPractice.useMutation();
  const addWord = trpc.words.addWord.useMutation({
    onSuccess: () => {
      void utils.words.listWords.invalidate();
    },
  });

  const userWords = listWords.data ?? [];

  const allWords = useMemo<DeckEntry[]>(() => {
    return [
      ...SEED_WORDS,
      ...userWords.map((w) => ({
        id: w.id,
        text: w.text,
        ipa: w.ipa,
        stressPattern: w.stressPattern,
        meaningZh: w.meaningZh,
        exampleEn: w.exampleEn,
      })),
    ];
  }, [userWords]);

  const [shuffleNonce, setShuffleNonce] = useState(0);
  const order = useMemo<DeckEntry[]>(
    () => (isClient ? shuffle(allWords) : allWords),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isClient, shuffleNonce, allWords],
  );
  const [pointer, setPointer] = useState(0);

  // Clamp pointer if order shrinks (rare — only if user removes a word; v1
  // doesn't support removal but we guard anyway).
  useEffect(() => {
    if (pointer >= order.length && order.length > 0) setPointer(0);
  }, [order.length, pointer]);

  const localPlayCountRef = useRef(0);
  const current = order[pointer];

  const flushIfNeeded = useCallback(
    (wordId: string, count: number) => {
      if (count <= 0) return;
      recordPractice.mutate(
        { wordId, increment: count },
        {
          onSuccess: () => {
            utils.words.getCounts.setData(undefined, (old) => {
              const prev = old ?? {};
              return { ...prev, [wordId]: (prev[wordId] ?? 0) + count };
            });
          },
        },
      );
    },
    [recordPractice, utils],
  );

  const playWord = useCallback(() => {
    if (!current) return;
    localPlayCountRef.current += 1;
    void speak(current.text);
  }, [current]);

  const playSentence = useCallback(() => {
    if (!current) return;
    void speak(current.exampleEn);
  }, [current]);

  const next = useCallback(() => {
    if (!current) return;
    flushIfNeeded(current.id, localPlayCountRef.current);
    localPlayCountRef.current = 0;
    cancelSpeech();
    setPointer((p) => {
      const np = p + 1;
      if (np >= order.length) {
        setShuffleNonce((n) => n + 1);
        return 0;
      }
      return np;
    });
  }, [current, flushIfNeeded, order.length]);

  // Auto-play current word once we're on the client and there's a word to play.
  useEffect(() => {
    if (!isClient) return;
    if (!isTtsSupported()) return;
    if (!current) return;
    localPlayCountRef.current += 1;
    void speak(current.text);
    return () => cancelSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointer, isClient, current?.id]);

  // beforeunload flush.
  useEffect(() => {
    const handler = () => {
      if (!current) return;
      flushIfNeeded(current.id, localPlayCountRef.current);
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [current, flushIfNeeded]);

  // Keyboard: Space=Word, S=Sentence, →=Next.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;
      if (e.code === "Space") { e.preventDefault(); playWord(); }
      else if (e.code === "KeyS") { e.preventDefault(); playSentence(); }
      else if (e.code === "ArrowRight") { e.preventDefault(); next(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [playWord, playSentence, next]);

  const counts = countsQuery.data ?? {};
  const currentLifetimeCount = current ? counts[current.id] ?? 0 : 0;
  const positionLabel = useMemo(
    () => (order.length > 0 ? `${pointer + 1} / ${order.length}` : "0 / 0"),
    [pointer, order.length],
  );

  // Add modal state.
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const submitAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = addText.trim();
      if (!trimmed) return;
      setAddError(null);
      try {
        await addWord.mutateAsync({ text: trimmed });
        setAddText("");
        setAddOpen(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to add word";
        setAddError(msg);
      }
    },
    [addText, addWord],
  );

  if (!isClient) return <div className="min-h-[80vh]" />;
  if (!isTtsSupported()) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <p className="max-w-md text-center text-sm text-stone-600 dark:text-stone-400">
          Your browser does not support speech synthesis. Try Chrome, Safari, or Edge.
        </p>
      </div>
    );
  }
  if (!current) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <p className="text-sm text-stone-500">Loading words…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6">
      <p
        data-testid="words-stress"
        className="text-balance text-center text-4xl font-medium tracking-tight text-stone-900 dark:text-stone-100"
      >
        {current.stressPattern}
      </p>
      <p
        data-testid="words-ipa"
        className="mt-4 text-center font-mono text-lg text-stone-600 dark:text-stone-400"
      >
        {current.ipa}
      </p>
      <p
        data-testid="words-meaning"
        className="mt-4 text-center text-base text-stone-700 dark:text-stone-300"
      >
        {current.meaningZh}
      </p>
      <p
        data-testid="words-example"
        className="mt-10 max-w-2xl text-balance text-center text-lg italic leading-relaxed text-stone-700 dark:text-stone-300"
      >
        “{current.exampleEn}”
      </p>

      <div className="mt-12 flex items-center gap-3">
        <button
          type="button"
          data-testid="words-play-word"
          onClick={playWord}
          className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
        >
          ▶ Word
        </button>
        <button
          type="button"
          data-testid="words-play-sentence"
          onClick={playSentence}
          className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
        >
          ▶ Sentence
        </button>
        <button
          type="button"
          data-testid="words-next"
          onClick={next}
          className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
        >
          Next →
        </button>
      </div>

      <div className="mt-10 flex w-full max-w-2xl items-center justify-between text-xs text-stone-400 dark:text-stone-500">
        <button
          type="button"
          data-testid="words-add-open"
          onClick={() => setAddOpen(true)}
          className="rounded-md border border-stone-300 px-3 py-1.5 text-stone-600 transition hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
        >
          + Add word
        </button>
        <div className="flex flex-col items-end">
          {currentLifetimeCount > 0 && (
            <span data-testid="words-practiced">Practiced {currentLifetimeCount} times</span>
          )}
          <span data-testid="words-position">{positionLabel}</span>
        </div>
      </div>

      {addOpen && (
        <div
          data-testid="words-add-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        >
          <form
            onSubmit={submitAdd}
            className="w-[min(90vw,420px)] rounded-xl bg-white p-6 shadow-xl dark:bg-stone-900"
          >
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              Add word
            </h2>
            <input
              autoFocus
              data-testid="words-add-input"
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              placeholder="e.g. epitome"
              className="mt-4 w-full rounded-md border border-stone-300 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:border-stone-700"
            />
            {addError && (
              <p data-testid="words-add-error" className="mt-2 text-xs text-red-600">
                {addError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setAddOpen(false); setAddError(null); setAddText(""); }}
                className="rounded-md px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="words-add-submit"
                disabled={addWord.isPending || addText.trim().length === 0}
                className="rounded-md bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-800 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
              >
                {addWord.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `pnpm build`. Expected: `/words` shows up in the route table, no TS errors.

- [ ] **Step 3: Smoke-test in dev**

```bash
pnpm dev
```

In a browser:
- Navigate to `/words` (sidebar entry doesn't exist yet — direct URL)
- Word card renders, Word/Sentence/Next play audio + advance
- Add modal opens, you can type a word; submitting either succeeds (consumes a real AI call) or shows an error (e.g. when self-hosted with no AI provider configured locally — that's expected for now)

Stop dev (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/words/page.tsx"
git commit -m "feat(words): page UI with stress + IPA + zh + example, Add modal"
```

---

## Task 6: Sidebar entry

**Files:**
- Modify: `src/components/layout/navigation.ts`

- [ ] **Step 1: Add icon import + nav entry**

Edit `src/components/layout/navigation.ts`. In the lucide import block, add `BookOpen`:

```ts
import {
  Activity,
  BookOpen,
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

In the LEARN group, add `/words` after `/speak`:

```ts
  {
    label: "LEARN",
    items: [
      { href: "/learn", label: "Learning", icon: GraduationCap },
      { href: "/projects", label: "Projects", icon: FolderGit2 },
      { href: "/speak", label: "Speak", icon: Mic },
      { href: "/words", label: "Words", icon: BookOpen },
    ],
  },
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/navigation.ts
git commit -m "feat(words): sidebar entry under LEARN"
```

---

## Task 7: E2E

**Files:**
- Create: `e2e/words.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Add `WORDS_E2E_MOCK` to default project env**

Edit `playwright.config.ts`. In the first `webServer` entry's `env` block (the one with `AUTH_BYPASS=true`, the default project), add a sibling line near `DRIFTER_E2E_MOCK: "1",`:

```ts
        DRIFTER_E2E_MOCK: "1",
        WORDS_E2E_MOCK: "1",
```

- [ ] **Step 2: Write the e2e**

Create `e2e/words.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.describe("Words", () => {
  test("sidebar entry leads to /words with card + buttons", async ({ page }) => {
    await page.goto("/");
    const link = page.locator("aside").getByRole("link", { name: "Words" });
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL("**/words");

    await expect(page.getByTestId("words-stress")).toBeVisible();
    await expect(page.getByTestId("words-ipa")).toBeVisible();
    await expect(page.getByTestId("words-meaning")).toBeVisible();
    await expect(page.getByTestId("words-example")).toBeVisible();
    await expect(page.getByTestId("words-play-word")).toBeVisible();
    await expect(page.getByTestId("words-play-sentence")).toBeVisible();
    await expect(page.getByTestId("words-next")).toBeVisible();
  });

  test("Next changes the visible word", async ({ page }) => {
    await page.goto("/words");
    const stress = page.getByTestId("words-stress");
    await expect(stress).toBeVisible();
    const before = (await stress.textContent())?.trim() ?? "";

    await page.getByTestId("words-next").click();
    await expect(async () => {
      const now = (await stress.textContent())?.trim() ?? "";
      expect(now).not.toEqual(before);
    }).toPass({ timeout: 2000 });
  });

  test("Add word flow (mocked AI) shows new word + dedupe", async ({ page }) => {
    await page.goto("/words");
    await expect(page.getByTestId("words-stress")).toBeVisible();

    await page.getByTestId("words-add-open").click();
    await expect(page.getByTestId("words-add-modal")).toBeVisible();

    const uniq = `e2etest${Date.now()}`;
    await page.getByTestId("words-add-input").fill(uniq);

    const addRespPromise = page.waitForResponse(
      (r) => r.url().includes("/api/trpc/words.addWord") && r.ok(),
      { timeout: 10000 },
    );
    await page.getByTestId("words-add-submit").click();
    await addRespPromise;

    // Modal should auto-close on success.
    await expect(page.getByTestId("words-add-modal")).toBeHidden({ timeout: 5000 });

    // Re-open and add the same word — should error with "Already in your list".
    await page.getByTestId("words-add-open").click();
    await page.getByTestId("words-add-input").fill(uniq);
    await page.getByTestId("words-add-submit").click();
    await expect(page.getByTestId("words-add-error")).toContainText(/already/i, {
      timeout: 5000,
    });
  });

  test("practice count persists across reload", async ({ page }) => {
    await page.goto("/words");
    await expect(page.getByTestId("words-stress")).toBeVisible();

    await page.getByTestId("words-play-word").click();
    await page.waitForTimeout(150);

    const recordPromise = page.waitForResponse(
      (r) => r.url().includes("/api/trpc/words.recordPractice") && r.ok(),
      { timeout: 5000 },
    );
    await page.getByTestId("words-next").click();
    await recordPromise;

    await page.goto("/words");
    await expect(page.getByTestId("words-stress")).toBeVisible();

    let found = false;
    for (let i = 0; i < 110; i++) {
      const counter = page.getByTestId("words-practiced");
      if ((await counter.count()) > 0) {
        const text = (await counter.textContent())?.trim() ?? "";
        expect(text).toMatch(/Practiced \d+ times/);
        found = true;
        break;
      }
      await page.getByTestId("words-next").click();
      await page.waitForTimeout(60);
    }
    expect(found).toBe(true);
  });
});
```

- [ ] **Step 3: Run the spec**

```bash
pnpm test:e2e e2e/words.spec.ts
```

Expected: 4 pass.

- [ ] **Step 4: Commit**

```bash
git add e2e/words.spec.ts playwright.config.ts
git commit -m "test(words): e2e for sidebar, Next, Add modal, persistence"
```

---

## Task 8: Self-verification gate

- [ ] **Step 1: Build**

```bash
pnpm build
```

Expected: pass, `/words` in routes.

- [ ] **Step 2: Lint (clear cache first)**

```bash
rm -rf .next-e2e .next-e2e-billing .next
pnpm lint
```

Expected: 0 errors. Pre-existing warnings in unrelated files are fine (the user's auto-memory `feedback_lint_e2e_cache.md` documents the cache-noise problem).

If your edit to `page.tsx` triggered `react-hooks/set-state-in-effect`, follow the same pattern `/speak` uses: `useSyncExternalStore` for client-only flag + `useMemo` keyed on a `nonce` for shuffle. The plan code already does this.

- [ ] **Step 3: E2E (speak + words isolated)**

```bash
pnpm test:e2e e2e/speak.spec.ts e2e/words.spec.ts
```

Expected: 7 pass total (3 speak + 4 words).

Skipping the full suite intentionally — there are pre-existing flaky failures on `main` in other specs (documented in the speak phase-1 changelog). Don't gate on them.

---

## Task 9: Production Turso rollout

**Files:**
- Create: `scripts/db/apply-2026-05-04-words-rollout.mjs`

- [ ] **Step 1: Write the rollout script**

Create `scripts/db/apply-2026-05-04-words-rollout.mjs`:

```js
#!/usr/bin/env node

/**
 * Production Turso rollout — words (pronunciation drill).
 *
 * Creates two new tables:
 *   user_words      — composite PK (user_id, word_id), unique idx on
 *                     (user_id, text_normalized), FK user_id → users
 *   word_practice   — composite PK (user_id, word_id), FK user_id → users
 *
 * Source: drizzle/00NN_*.sql generated in Task 1.
 * Idempotent.
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

console.log("Production Turso rollout — words (pronunciation drill)");
console.log(`Target: ${url}`);
console.log("");

async function tableExists(name) {
  const r = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [name],
  });
  return r.rows.length > 0;
}
async function indexExists(name) {
  const r = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?",
    args: [name],
  });
  return r.rows.length > 0;
}

if (!(await tableExists("user_words"))) {
  console.log("Creating user_words...");
  await client.execute(`
    CREATE TABLE user_words (
      user_id text NOT NULL,
      word_id text NOT NULL,
      text text NOT NULL,
      text_normalized text NOT NULL,
      ipa text NOT NULL,
      stress_pattern text NOT NULL,
      meaning_zh text NOT NULL,
      example_en text NOT NULL,
      created_at integer NOT NULL,
      PRIMARY KEY (user_id, word_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
    )
  `);
} else {
  console.log("Skip — user_words already exists.");
}

if (!(await indexExists("user_words_user_text_idx"))) {
  await client.execute(
    "CREATE UNIQUE INDEX user_words_user_text_idx ON user_words (user_id, text_normalized)"
  );
}

if (!(await tableExists("word_practice"))) {
  console.log("Creating word_practice...");
  await client.execute(`
    CREATE TABLE word_practice (
      user_id text NOT NULL,
      word_id text NOT NULL,
      count integer NOT NULL DEFAULT 0,
      last_practiced_at integer NOT NULL,
      PRIMARY KEY (user_id, word_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
    )
  `);
} else {
  console.log("Skip — word_practice already exists.");
}

console.log("");
console.log("Verification:");

for (const t of ["user_words", "word_practice"]) {
  if (!(await tableExists(t))) {
    console.error(`  FAIL — missing table ${t}`);
    process.exit(1);
  }
  console.log(`  OK — table ${t} exists`);

  const fkResult = await client.execute({
    sql: `PRAGMA foreign_key_list('${t}')`,
  });
  const usersFk = fkResult.rows.find((r) => r.table === "users");
  if (!usersFk || usersFk.on_delete !== "CASCADE") {
    console.error(`  FAIL — ${t} missing FK to users(id) ON DELETE CASCADE`);
    process.exit(1);
  }
  console.log(`  OK — ${t}.user_id → users(id) ON DELETE CASCADE`);

  const pkResult = await client.execute({
    sql: `PRAGMA table_info('${t}')`,
  });
  const pkCols = pkResult.rows
    .filter((r) => r.pk > 0)
    .sort((a, b) => Number(a.pk) - Number(b.pk))
    .map((r) => r.name);
  if (pkCols.join(",") !== "user_id,word_id") {
    console.error(
      `  FAIL — ${t} composite PK columns are ${pkCols.join(",") || "(none)"}, expected user_id,word_id`,
    );
    process.exit(1);
  }
  console.log(`  OK — ${t} composite PK (user_id, word_id)`);
}

if (!(await indexExists("user_words_user_text_idx"))) {
  console.error("  FAIL — missing unique index user_words_user_text_idx");
  process.exit(1);
}
console.log("  OK — unique index user_words_user_text_idx exists");

console.log("");
console.log("✅ Production rollout verified: words schema is ready.");
```

- [ ] **Step 2: Run the rollout**

```bash
node scripts/db/apply-2026-05-04-words-rollout.mjs
```

Expected: ends with `✅ Production rollout verified: words schema is ready.`

- [ ] **Step 3: Commit**

```bash
git add scripts/db/apply-2026-05-04-words-rollout.mjs
git commit -m "ops(words): production Turso rollout script"
```

---

## Task 10: Changelog + README

- [ ] **Step 1: Changelog**

Create `docs/changelog/2026-05-04-words-phase-1.md`:

```markdown
# Words — Pronunciation Drill Phase 1 (2026-05-04)

## Goal
Pair `/speak` (sentence-level shadow drill) with `/words`, a word-level pronunciation drill that shows stress visualization, IPA, brief Chinese meaning, and one native example sentence per card. Users append words via an Add modal that calls AI to enrich on save.

## Key changes
- New tables `user_words` (with unique index on `user_id + text_normalized`) and `word_practice`.
- New tRPC router `words` with `addWord` (proProcedure, calls AI), `listWords`, `recordPractice`, `getCounts`.
- New `/words` page with stress/IPA/meaning/example display, three TTS buttons (Word / Sentence / Next), and a +Add word modal.
- 100 hand-picked seed words enriched once via AI and human-reviewed before being committed to `src/lib/words/seed.ts`. AI is invoked at runtime only when a user adds a new word.
- Sidebar entry in LEARN section with `BookOpen` icon.
- E2E mock via `WORDS_E2E_MOCK=1` so Playwright doesn't burn tokens.

## Files touched
- New: `src/server/db/schema/words.ts`, `src/server/routers/words.ts`, `src/server/ai/words.ts`, `src/lib/words/seed.ts`, `src/app/(app)/words/page.tsx`, `e2e/words.spec.ts`, `scripts/words/generate-seed-enrichment.mjs`, `scripts/db/apply-2026-05-04-words-rollout.mjs`, `docs/changelog/2026-05-04-words-phase-1.md`.
- Modified: `src/server/db/schema/index.ts`, `src/server/routers/_app.ts`, `src/components/layout/navigation.ts`, `playwright.config.ts`, `README.md`.
- Migration: `drizzle/00NN_*.sql`.

## Database changes
- `user_words` (user_id text, word_id text, text text, text_normalized text, ipa text, stress_pattern text, meaning_zh text, example_en text, created_at integer, PK(user_id, word_id), FK user_id → users(id) ON DELETE CASCADE, UNIQUE(user_id, text_normalized))
- `word_practice` (user_id text, word_id text, count integer DEFAULT 0, last_practiced_at integer, PK(user_id, word_id), FK user_id → users(id) ON DELETE CASCADE)
- Local: `pnpm db:generate` + `pnpm db:push` ✓
- Production Turso: `node scripts/db/apply-2026-05-04-words-rollout.mjs` → ✅ verified

## Verification
- `pnpm build` — pass
- `pnpm lint` (cache cleared) — 0 errors
- `pnpm test:e2e e2e/speak.spec.ts e2e/words.spec.ts` — all pass

## Known limitations / follow-ups
- AI enrichment quality is bounded by the configured provider; user-added words may produce IPA / stress that doesn't perfectly follow the prompted format. v1 stores whatever the AI returns; future work can add a "fix this entry" button.
- 100 fixed seed words plus user additions only. No public word-list import (NGSL, Oxford 3000) in v1.
- No SRS, no recording, no slow-speed. All explicit non-goals.
- Word removal is not in v1 (the page guards against `pointer >= order.length` so a future remove button is safe).

## Spec & plan
- Spec: `docs/superpowers/specs/2026-05-04-words-pronunciation-drill-design.md`
- Plan: `docs/superpowers/plans/2026-05-04-words-pronunciation-drill.md`
```

- [ ] **Step 2: README entry**

Edit `README.md`. In the LEARN-related modules list (where `Speak` was added), add:

```markdown
- **Words** — `/words` per-word pronunciation drill. Stress visualization, IPA, brief meaning, and a native example sentence per card. 100 hand-picked seeds. Add your own words; AI enriches them on save. Browser TTS reused from `/speak`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/changelog/2026-05-04-words-phase-1.md README.md
git commit -m "docs(words): phase 1 changelog + README entry"
```

---

## Task 11: Push (deploys)

- [ ] **Step 1: Confirm clean state**

```bash
git status
git log --oneline origin/main..HEAD
```

Expect 9-11 new commits, all `feat/test/ops/docs(words): …`.

- [ ] **Step 2: Push**

```bash
git push origin main
```

Expected: push succeeds, Hetzner workflow triggers, deploy completes within ~5 min.

- [ ] **Step 3: Smoke-check production**

Open the production URL, sign in:
- LEARN sidebar shows "Words"
- `/words` loads, card renders, Word / Sentence / Next play audio
- Add a word — should succeed (real AI provider used in prod)
- Practice count persists across reload

Roll back via `git revert <last-merge-sha>` if anything is broken; the rollout script is already idempotent so no DB rollback needed.

---

## Self-Review

**Spec coverage:** Skimmed every section in the spec. Tasks 1–11 cover schema, AI helper, seed pipeline, router, page UI (including Add modal), sidebar, e2e, verification, prod rollout, and docs. Out-of-scope items in the spec are explicitly not in any task.

**Placeholder check:** Searched the plan for `TBD`, `TODO`, `implement later`. Only `TODO`/`TBD` references are inside example seed lists (the engineer is told to fix the duplicates) and inside the rollout script's docstring referencing `00NN_*.sql` (resolved in Task 1).

**Type consistency:**
- `wordId` regex `^(w_\d{3}|uw_[A-Za-z0-9-]+)$` matches both seed IDs (`w_001`) and user IDs (`uw_<UUID>` — UUID is hex+dashes).
- `enrichWord(text, ctx)` signature matches the call site in `addWord` and in the seed script.
- Seed JSON shape `{ id, text, ipa, stressPattern, meaningZh, exampleEn }` matches `SeedWord` matches `userWords` selected columns matches client `DeckEntry`.
- `WORDS_E2E_MOCK=1` consistently spelled across helper, playwright config, and e2e.

One thing the engineer should pay attention to: in Task 5 the `useEffect` for auto-play uses `current?.id` in the deps comment — keep that spelling, don't accidentally swap to `current?.text` (would re-fire on every shuffle that lands on the same id post-reshuffle).

---

## Execution Handoff

Plan complete. Saved to `docs/superpowers/plans/2026-05-04-words-pronunciation-drill.md`.

Two execution options:
1. **Subagent-Driven** (recommended) — fresh subagent per task, review between.
2. **Inline Execution** — run tasks in this session with checkpoints.

Which approach?
