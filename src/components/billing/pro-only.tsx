"use client";

import Link from "next/link";
import { useEntitlements } from "@/hooks/use-entitlements";

type Feature = "portfolio" | "focusTracker" | "ossProjects" | "claudeCapture";

type Props = {
  feature: Feature;
  title: string;
  description: string;
  /**
   * Whether the user has any existing rows for this module. When undefined
   * (i.e. the `hasAny` query hasn't resolved yet) we conservatively render
   * the upgrade gate for Free users to avoid a flicker where the full module
   * appears briefly.
   */
  hasData?: boolean;
  children: React.ReactNode;
};

/**
 * Pro-feature gate with read-only fallback.
 *
 * - Pro user: renders `children` unchanged.
 * - Free user with existing data: renders a read-only banner above
 *   `children`. Mutations inside still throw PRO_REQUIRED at the tRPC layer,
 *   so the banner is a UX hint, not the enforcement boundary.
 * - Free user with no data: renders the full upgrade splash (hides module).
 *
 * Spec §8.2 — data always readable, writes gated.
 */
export function ProOnly({ feature, title, description, hasData, children }: Props) {
  const ent = useEntitlements();
  if (!ent) return null;
  if (ent.features[feature]) return <>{children}</>;

  if (hasData) {
    return (
      <>
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <span className="mr-2" aria-hidden>
            🔒
          </span>
          You&apos;re viewing in read-only mode.{" "}
          <Link
            href="/pricing"
            className="font-medium underline underline-offset-2"
          >
            Upgrade to Pro
          </Link>{" "}
          to make changes.
        </div>
        {children}
      </>
    );
  }

  return (
    <div className="mx-auto mt-12 max-w-xl rounded-xl border border-stone-200 bg-white/70 p-8 text-center dark:border-stone-800 dark:bg-stone-950/60">
      <div className="text-4xl" aria-hidden>
        🔒
      </div>
      <h2 className="mt-2 text-2xl font-semibold text-stone-900 dark:text-stone-100">
        {title} is a Pro feature.
      </h2>
      <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
        {description}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/pricing"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-600"
        >
          Upgrade to Pro — $9/mo
        </Link>
        <Link
          href="/pricing"
          className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-200 dark:hover:bg-stone-900"
        >
          See what else Pro includes →
        </Link>
      </div>
    </div>
  );
}
