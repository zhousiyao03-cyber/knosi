import crypto from "crypto";
import { router, protectedProcedure } from "../trpc";
import { db } from "../db";
import { portfolioHoldings, portfolioNews } from "../db/schema";
import { and, eq, desc } from "drizzle-orm";
import { z } from "zod/v4";

export const portfolioRouter = router({
  // ── 持仓 CRUD ──────────────────────────────────────────────
  getHoldings: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(portfolioHoldings)
      .where(eq(portfolioHoldings.userId, ctx.userId))
      .orderBy(desc(portfolioHoldings.createdAt));
  }),

  addHolding: protectedProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(20).transform((s) => s.toUpperCase()),
        name: z.string().min(1).max(100),
        assetType: z.enum(["stock", "crypto"]),
        quantity: z.number().positive(),
        costPrice: z.number().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const id = crypto.randomUUID();
      await db.insert(portfolioHoldings).values({
        id,
        userId: ctx.userId,
        ...input,
      });
      return { id };
    }),

  updateHolding: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        quantity: z.number().positive().optional(),
        costPrice: z.number().positive().optional(),
      }).refine(
        ({ quantity, costPrice }) => quantity !== undefined || costPrice !== undefined,
        { message: "At least one field must be updated" }
      )
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db
        .update(portfolioHoldings)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(
            eq(portfolioHoldings.id, id),
            eq(portfolioHoldings.userId, ctx.userId)
          )
        );
      return { id };
    }),

  deleteHolding: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(portfolioHoldings)
        .where(
          and(
            eq(portfolioHoldings.id, input.id),
            eq(portfolioHoldings.userId, ctx.userId)
          )
        );
      return { success: true };
    }),

  // ── 新闻（占位，Task 4 补充实现）──────────────────────────────
  getNews: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(portfolioNews)
      .where(eq(portfolioNews.userId, ctx.userId))
      .orderBy(desc(portfolioNews.generatedAt));
  }),

  refreshNews: protectedProcedure
    .input(z.object({ symbol: z.string() }))
    .mutation(async () => {
      // placeholder — real implementation in Task 4
      return { success: true };
    }),

  // ── 价格（占位，Task 3 补充实现）──────────────────────────────
  getPrices: protectedProcedure
    .input(
      z.object({
        symbols: z.array(z.string()),
        assetTypes: z.array(z.enum(["stock", "crypto"])),
      }).refine(
        ({ symbols, assetTypes }) => symbols.length === assetTypes.length,
        { message: "symbols and assetTypes must have the same length" }
      )
    )
    .query(async () => {
      // placeholder — real implementation in Task 3
      return {} as Record<string, { price: number | null; changePercent: number | null }>;
    }),
});
