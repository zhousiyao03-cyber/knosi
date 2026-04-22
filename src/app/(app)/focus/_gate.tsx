"use client";

import { trpc } from "@/lib/trpc";
import { ProOnly } from "@/components/billing/pro-only";

/**
 * Client-side gate for the Focus Tracker module. Kept separate from the
 * server page so we don't need to push the entire page into a client
 * component just to consume `trpc.useQuery`.
 */
export function FocusGate({ children }: { children: React.ReactNode }) {
  const { data } = trpc.focus.hasAny.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <ProOnly
      feature="focusTracker"
      title="Focus Tracker"
      description="Track time spent across applications and get daily AI summaries."
      hasData={data?.hasAny}
    >
      {children}
    </ProOnly>
  );
}
