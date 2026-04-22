import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { invalidateEntitlements } from "@/server/billing/entitlements";
import { db } from "@/server/db";
import { users } from "@/server/db/schema/auth";
import { protectedProcedure, router } from "@/server/trpc";

/**
 * billing.me returns the current user's entitlements.
 *
 * Task 14's trpc.ts fix makes `ctx.entitlements` always defined on
 * protectedProcedure — it falls back to PRO_UNLIMITED when there is no
 * userId (self-hosted / E2E bypass), so no runtime guard is needed here.
 */
export const billingRouter = router({
  me: protectedProcedure.query(({ ctx }) => {
    return ctx.entitlements;
  }),

  /**
   * Store the user's preferred AI provider backend. `null` means "default",
   * which for Pro users resolves to the Knosi-hosted pool and for everyone
   * else falls back to the env-configured provider.
   */
  setAiProviderPreference: protectedProcedure
    .input(
      z.object({
        preference: z
          .enum(["knosi-hosted", "claude-code-daemon", "openai", "local"])
          .nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx as { userId?: string }).userId;
      if (!userId) {
        // Self-hosted / E2E bypass — no user row to update.
        return { ok: true as const };
      }
      await db
        .update(users)
        .set({ aiProviderPreference: input.preference })
        .where(eq(users.id, userId));
      await invalidateEntitlements(userId);
      return { ok: true as const };
    }),
});
