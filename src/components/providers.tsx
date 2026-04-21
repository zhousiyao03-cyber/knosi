"use client";

import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { QuotaModalMount, showQuotaModal } from "@/components/billing/quota-modal";
import { trpc } from "@/lib/trpc";
import superjson from "superjson";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  return `http://localhost:${process.env.PORT ?? 3200}`;
}

/**
 * Intercept tRPC FORBIDDEN errors whose message is a JSON envelope with
 * `reason` of "PRO_REQUIRED" or "QUOTA_EXCEEDED" and surface the shared
 * upsell modal. All other errors flow through unchanged for caller handling.
 */
function handleTrpcError(error: unknown) {
  const err = error as { data?: { code?: string }; message?: string };
  if (err?.data?.code !== "FORBIDDEN") return;
  if (!err.message) return;
  try {
    const parsed = JSON.parse(err.message) as {
      reason?: string;
      resource?: string;
      current?: number;
      limit?: number;
    };
    if (parsed.reason === "QUOTA_EXCEEDED" || parsed.reason === "PRO_REQUIRED") {
      showQuotaModal({
        reason: parsed.reason,
        resource: parsed.resource,
        current: parsed.current,
        limit: parsed.limit,
      });
    }
  } catch {
    // Not a structured quota/pro error — ignore.
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: false,
          },
        },
        queryCache: new QueryCache({ onError: handleTrpcError }),
        mutationCache: new MutationCache({ onError: handleTrpcError }),
      }),
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    })
  );

  return (
    <SessionProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {children}
          <QuotaModalMount />
        </QueryClientProvider>
      </trpc.Provider>
    </SessionProvider>
  );
}
