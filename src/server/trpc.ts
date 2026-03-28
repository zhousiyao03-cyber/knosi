import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "@/lib/auth";

const t = initTRPC.create({
  transformer: superjson,
});

const authMiddleware = t.middleware(async ({ next }) => {
  // Allow bypass for E2E testing
  if (process.env.AUTH_BYPASS === "true") {
    return next({ ctx: { userId: process.env.AUTH_BYPASS_USER_ID ?? "test-user" } });
  }

  const session = await auth();
  if (!session?.user?.id) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { userId: session.user.id } });
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(authMiddleware);
