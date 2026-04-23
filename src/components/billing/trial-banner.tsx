"use client";

import Link from "next/link";
import { useState } from "react";
import { useEntitlements } from "@/hooks/use-entitlements";

const DISMISS_KEY = "billing.trial.dismissed";

function readDismissed() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Last-3-days hosted-trial countdown banner.
 *
 * Rendered only when:
 *  - the user is on a hosted trial, and
 *  - <= 3 days remain.
 *
 * Dismissible via localStorage, but the final day (<= 1 day left) is
 * re-shown regardless of prior dismissal.
 */
export function TrialBanner() {
  const ent = useEntitlements();
  const [dismissed, setDismissed] = useState(readDismissed);
  // Capture render-time "now" via lazy state initializer so the component
  // stays pure under React 19's purity rule.
  const [now] = useState(() => Date.now());

  if (!ent || ent.source !== "hosted-trial") return null;

  const daysLeft = Math.max(
    0,
    Math.ceil(((ent.trialEndsAt ?? 0) - now) / 86_400_000),
  );
  if (daysLeft > 3) return null;

  const lastDay = daysLeft <= 1;
  if (dismissed && !lastDay) return null;

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
      <span>
        Your 7-day Pro trial ends in {daysLeft} day{daysLeft === 1 ? "" : "s"}.
      </span>
      <div className="flex gap-3">
        <Link href="/pricing" className="font-medium underline underline-offset-2">
          Upgrade
        </Link>
        {!lastDay && (
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(DISMISS_KEY, "1");
              setDismissed(true);
            }}
            className="opacity-60 transition-opacity hover:opacity-100"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
