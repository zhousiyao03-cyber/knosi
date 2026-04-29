import type { Metadata } from "next";

/**
 * Privacy hardening for the CLI authorization screen.
 *
 * The session_id is part of the URL; with default referrer policy any
 * third-party resource loaded on the page (analytics, fonts, error reporters,
 * etc.) would receive the full URL via the Referer header. `no-referrer`
 * blocks all outbound Referer headers from this route. Combined with the CF
 * Insights skip (see <CloudflareInsights/>) this keeps the session_id from
 * leaving the box via observable side channels.
 */
export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
    nocache: true,
  },
};

export default function CliAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
