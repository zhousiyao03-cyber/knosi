"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

/**
 * Cloudflare Web Analytics beacon.
 *
 * Skipped on /cli/auth* — that page receives a one-time CLI session_id in the
 * URL, and CF Insights records full page URLs (including query strings) on
 * cloud.cloudflare.com. Excluding the page prevents the bearer-equivalent
 * session_id from leaving the box. The beacon stays on every other page.
 */
const SKIP_PATH_PREFIXES = ["/cli/auth"];

export function CloudflareInsights() {
  const pathname = usePathname();
  if (pathname && SKIP_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }

  return (
    <Script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon='{"token": "77230078425f404aa623df2e0c39e471"}'
      strategy="afterInteractive"
    />
  );
}
