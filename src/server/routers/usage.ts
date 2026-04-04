import { z } from "zod/v4";
import { scanLocalUsage } from "@/server/usage-scanner";
import { protectedProcedure, router } from "../trpc";

export const usageRouter = router({
  list: protectedProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).optional() }).optional())
    .query(({ input }) => {
      const days = input?.days ?? 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().slice(0, 10);

      const all = scanLocalUsage();
      return all.filter((r) => r.date >= cutoffStr);
    }),
});
