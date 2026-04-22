"use client";

import { trpc } from "@/lib/trpc";
import { ProOnly } from "@/components/billing/pro-only";

/**
 * Client-side gate for the Portfolio module. Kept separate from the server
 * page so we don't need to push the entire page into a client component just
 * to consume `trpc.useQuery`.
 */
export function PortfolioGate({ children }: { children: React.ReactNode }) {
  const { data } = trpc.portfolio.hasAny.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  return (
    <ProOnly
      feature="portfolio"
      title="Portfolio Tracker"
      description="Track positions, get AI analysis, and follow market news."
      hasData={data?.hasAny}
    >
      {children}
    </ProOnly>
  );
}
