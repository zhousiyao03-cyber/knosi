"use client";

import Link from "next/link";
import { useEntitlements } from "@/hooks/use-entitlements";

/**
 * Top-bar entitlement indicator.
 *
 * - Pro user (non-trial): renders nothing.
 * - Self-hosted: renders nothing (no upsell on self-hosted installs).
 * - Hosted trial: shows a pill with remaining days linking to billing.
 * - Free hosted: shows a golden "Upgrade" button.
 *
 * Self-positions as a fixed top-right pill so it does not consume vertical
 * space when it renders nothing.
 */
export function UpgradeBadge() {
  const ent = useEntitlements();
  if (!ent) return null;
  if (ent.source === "self-hosted") return null;
  if (ent.plan === "pro" && ent.source !== "hosted-trial") return null;

  if (ent.source === "hosted-trial") {
    const days = Math.max(
      0,
      Math.ceil(((ent.trialEndsAt ?? 0) - Date.now()) / 86_400_000),
    );
    return (
      <div className="pointer-events-none fixed right-4 top-3 z-20 md:right-6 md:top-4">
        <Link
          href="/settings/billing"
          className="pointer-events-auto rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 shadow-sm transition-colors hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/60"
        >
          Trial: {days} day{days === 1 ? "" : "s"} left
        </Link>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed right-4 top-3 z-20 md:right-6 md:top-4">
      <Link
        href="/pricing"
        className="pointer-events-auto rounded-lg bg-amber-500 px-3 py-1 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600"
      >
        Upgrade
      </Link>
    </div>
  );
}
