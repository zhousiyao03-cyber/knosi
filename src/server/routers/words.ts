import crypto from "crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";

import { enrichWord } from "../ai/words";
import { db } from "../db";
import { userWords, wordPractice } from "../db/schema";
import { proProcedure, protectedProcedure, router } from "../trpc";

const recordPracticeInput = z.object({
  // Seed: w_NNN. User-added: uw_<UUID>. UUID is hex+dashes.
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
