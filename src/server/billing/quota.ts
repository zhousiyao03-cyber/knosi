// src/server/billing/quota.ts
import { TRPCError } from "@trpc/server";
import type { Entitlements, Limit } from "./entitlements";

export type QuotaResource = "notes" | "storageMB" | "shareLinks";

export function assertQuota(
  entitlements: Entitlements,
  resource: QuotaResource,
  currentUsage: number,
  delta = 1,
): void {
  const limit: Limit = entitlements.limits[resource];
  if (limit === "unlimited") return;
  if (currentUsage + delta > limit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: JSON.stringify({
        reason: "QUOTA_EXCEEDED",
        resource,
        current: currentUsage,
        limit,
      }),
    });
  }
}
