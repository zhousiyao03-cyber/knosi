"use client";

import Link from "next/link";
import { ArrowUpRight, Clock, Sparkles } from "lucide-react";
import { useEntitlements } from "@/hooks/use-entitlements";
import { cn } from "@/lib/utils";

/**
 * Plan status card rendered at the bottom of the sidebar.
 *
 * Mirrors Notion's pattern of keeping the upgrade CTA inline with navigation
 * rather than overlapping page content with a fixed badge.
 *
 *   - Pro (non-trial):    renders nothing
 *   - Self-hosted:        renders nothing
 *   - Hosted trial:       "Pro trial · N days left" pill with Upgrade link
 *   - Free hosted:        "Free plan · Upgrade to Pro" pill
 */
export function PlanCard({ collapsed = false }: { collapsed?: boolean }) {
  const ent = useEntitlements();
  if (!ent) return null;
  if (ent.source === "self-hosted") return null;
  if (ent.plan === "pro" && ent.source !== "hosted-trial") return null;

  const isTrial = ent.source === "hosted-trial";
  const daysLeft = isTrial
    ? Math.max(
        0,
        Math.ceil(((ent.trialEndsAt ?? 0) - Date.now()) / 86_400_000),
      )
    : 0;

  const Icon = isTrial ? Clock : Sparkles;
  const label = isTrial ? "Pro trial" : "Free plan";
  const cta = isTrial
    ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
    : "Upgrade to Pro";
  const href = isTrial ? "/settings/billing" : "/pricing";

  if (collapsed) {
    return (
      <Link
        href={href}
        aria-label={isTrial ? `Trial: ${cta}` : cta}
        title={isTrial ? `Trial: ${cta}` : cta}
        className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100/80 text-amber-700 transition-colors hover:bg-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/60"
      >
        <Icon className="h-[15px] w-[15px]" strokeWidth={1.8} />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      aria-label={isTrial ? `Trial: ${cta}` : cta}
      className={cn(
        "group mx-1 mb-2 flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors",
        "border-amber-200/70 bg-gradient-to-br from-amber-50 to-amber-100/50 hover:border-amber-300 hover:from-amber-100/80 hover:to-amber-100",
        "dark:border-amber-900/40 dark:from-amber-950/30 dark:to-amber-900/20 dark:hover:border-amber-800/70 dark:hover:from-amber-950/50",
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
        <Icon className="h-[14px] w-[14px]" strokeWidth={1.9} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700/80 dark:text-amber-300/80">
          {label}
        </span>
        <span className="block truncate text-[12.5px] font-medium text-amber-950 dark:text-amber-50">
          {cta}
        </span>
      </span>
      <ArrowUpRight
        className="h-3.5 w-3.5 shrink-0 text-amber-600/70 transition-transform group-hover:-translate-y-px group-hover:translate-x-px dark:text-amber-300/70"
        strokeWidth={2}
      />
    </Link>
  );
}
