import Link from "next/link";
import { PricingTable } from "@/components/billing/pricing-table";

export const dynamic = "force-static";

export const metadata = {
  title: "Pricing — Knosi",
  description: "Start free. Upgrade when you need more.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-4xl font-bold">Start free. Upgrade when you need more.</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Self-host Knosi for free, forever — or let us run it for you.
        </p>
        <PricingTable />
        <p className="mt-10 text-sm text-neutral-500 dark:text-neutral-400">
          Pro is billed in USD via Lemon Squeezy and renews automatically until
          cancelled. Cancel anytime from{" "}
          <strong>Settings &rarr; Billing</strong>. Backed by a 14-day
          money-back guarantee — see the{" "}
          <Link href="/legal/refund" className="underline">
            Refund Policy
          </Link>
          .
        </p>
      </main>
      <footer className="border-t border-neutral-200 py-8 dark:border-neutral-800">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-6 text-xs text-neutral-500">
          <Link href="/" className="hover:text-neutral-900 dark:hover:text-neutral-100">
            Home
          </Link>
          <Link
            href="/legal/terms"
            className="hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Terms
          </Link>
          <Link
            href="/legal/privacy"
            className="hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Privacy
          </Link>
          <Link
            href="/legal/refund"
            className="hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            Refunds
          </Link>
          <a
            href="mailto:support@knosi.xyz"
            className="hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            support@knosi.xyz
          </a>
        </div>
      </footer>
    </div>
  );
}
