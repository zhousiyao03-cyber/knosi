// Minimal stub — Task 26 replaces with interactive version (monthly/annual toggle + checkout).
"use client";

export function PricingTable() {
  return (
    <div className="mt-10 grid gap-6 md:grid-cols-2">
      <div className="rounded-xl border p-6">
        <h3 className="text-lg font-semibold">Free</h3>
        <div className="mt-2 text-3xl font-bold">$0</div>
        <ul className="mt-4 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
          <li>• 20 Ask AI calls / day (bring your own provider)</li>
          <li>• 50 notes</li>
          <li>• 100 MB image storage</li>
          <li>• 3 share links</li>
          <li>• Core editor, tags, search, dark mode</li>
        </ul>
      </div>
      <div className="rounded-xl border border-amber-500 p-6 shadow-lg">
        <h3 className="text-lg font-semibold">Pro</h3>
        <div className="mt-2 text-3xl font-bold">$9 / mo</div>
        <ul className="mt-4 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
          <li>• 80 Ask AI calls / day (Knosi AI included — no setup)</li>
          <li>• Unlimited notes</li>
          <li>• 10 GB image storage</li>
          <li>• Unlimited share links</li>
          <li>• Portfolio Tracker, Focus Tracker, OSS Projects, Claude Capture</li>
          <li>• Priority email support</li>
        </ul>
      </div>
    </div>
  );
}
