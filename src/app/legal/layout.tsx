import Link from "next/link";
import Image from "next/image";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/knosi-logo.png"
              alt="Knosi"
              width={28}
              height={28}
              className="rounded-md"
              unoptimized
            />
            <span className="text-sm font-semibold tracking-tight">Knosi</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
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
            <Link
              href="/pricing"
              className="hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              Pricing
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
      <footer className="border-t border-neutral-200 py-8 dark:border-neutral-800">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 px-6 text-xs text-neutral-500 sm:flex-row sm:justify-between">
          <span>&copy; {new Date().getFullYear()} Knosi</span>
          <span>
            Contact:{" "}
            <a
              href="mailto:support@knosi.xyz"
              className="underline hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              support@knosi.xyz
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
