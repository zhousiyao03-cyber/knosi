"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type QuotaEvent = {
  reason: "QUOTA_EXCEEDED" | "PRO_REQUIRED";
  resource?: string;
  current?: number;
  limit?: number;
};

// Module-level emitter. Assigned by <QuotaModalMount /> on mount.
let emit: (e: QuotaEvent) => void = () => {};

/** Imperatively open the quota / upsell modal from anywhere. */
export function showQuotaModal(e: QuotaEvent) {
  emit(e);
}

/**
 * Mount point for the shared quota / upsell modal.
 *
 * Mounted once inside <Providers /> so any client code can call
 * showQuotaModal(...) without needing context. The tRPC error interceptor
 * calls it on FORBIDDEN errors with a JSON-encoded reason.
 */
export function QuotaModalMount() {
  const [event, setEvent] = useState<QuotaEvent | null>(null);

  useEffect(() => {
    emit = setEvent;
    return () => {
      emit = () => {};
    };
  }, []);

  if (!event) return null;

  const title =
    event.reason === "PRO_REQUIRED"
      ? "This is a Pro feature."
      : `You've hit the Free limit${event.resource ? ` for ${event.resource}` : ""}.`;

  const detail =
    event.reason === "QUOTA_EXCEEDED"
      ? `Current: ${event.current} / ${event.limit}${event.resource ? ` ${event.resource}` : ""}`
      : "Upgrade to Pro to unlock.";

  const close = () => setEvent(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={close}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-neutral-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quota-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="quota-modal-title"
          className="text-lg font-semibold text-stone-900 dark:text-stone-100"
        >
          {title}
        </h3>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          {detail}
        </p>
        <p className="mt-4 text-sm text-stone-700 dark:text-stone-300">
          Upgrade to Pro for unlimited access + all modules.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
            onClick={close}
          >
            Maybe later
          </button>
          <Link
            href="/pricing"
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
            onClick={close}
          >
            Upgrade — $9/mo
          </Link>
        </div>
      </div>
    </div>
  );
}
