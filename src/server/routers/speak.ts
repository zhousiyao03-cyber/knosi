import { eq, sql } from "drizzle-orm";
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
      const now = Date.now();

      await db
        .insert(speakSentencePractice)
        .values({
          userId: ctx.userId,
          sentenceId: input.sentenceId,
          count: input.increment,
          lastPracticedAt: now,
        })
        .onConflictDoUpdate({
          target: [speakSentencePractice.userId, speakSentencePractice.sentenceId],
          set: {
            count: sql`${speakSentencePractice.count} + ${input.increment}`,
            lastPracticedAt: now,
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
