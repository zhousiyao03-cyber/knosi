import { PricingTable } from "@/components/billing/pricing-table";

export const dynamic = "force-static";

export const metadata = {
  title: "Pricing — Knosi",
  description: "Start free. Upgrade when you need more.",
};

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-4xl font-bold">Start free. Upgrade when you need more.</h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-400">
        Self-host Knosi for free, forever — or let us run it for you.
      </p>
      <PricingTable />
    </main>
  );
}
