import type { MetadataRoute } from "next";

const SITE_URL = "https://www.knosi.xyz";

export const revalidate = 3600;

/**
 * Public sitemap.
 *
 * Intentionally NOT enumerating /share/<token> URLs here. A share token is a
 * private, capability-style URL — discoverability via sitemap.xml turns "anyone
 * with the link" into "indexed by search engines + scrapable". See
 * docs/changelog/2026-04-28-privacy-fixes.md for context.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/legal/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/legal/refund`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
