import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { aiUsage } from "./db/schema";

const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT) || 50;

export async function checkAiRateLimit(
  userId: string
): Promise<{ allowed: boolean; remaining: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const [usage] = await db
    .select()
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), eq(aiUsage.date, today)));

  const currentCount = usage?.count ?? 0;
  return {
    allowed: currentCount < AI_DAILY_LIMIT,
    remaining: Math.max(0, AI_DAILY_LIMIT - currentCount),
  };
}

export async function recordAiUsage(userId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await db
    .insert(aiUsage)
    .values({ id: crypto.randomUUID(), userId, date: today, count: 1 })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.date],
      set: { count: sql`${aiUsage.count} + 1` },
    });
}
