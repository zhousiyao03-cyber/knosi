import { trpc } from "@/lib/trpc";

export function useEntitlements() {
  const query = trpc.billing.me.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  return query.data;
}
