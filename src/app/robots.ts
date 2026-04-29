import type { MetadataRoute } from "next";

const SITE_URL = "https://www.knosi.xyz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/api/",
          "/oauth/",
          "/login",
          "/register",
          "/dashboard",
          "/notes",
          "/learn",
          "/projects",
          "/portfolio",
          "/focus",
          "/ask",
          "/bookmarks",
          "/explore",
          "/settings",
          "/workflows",
          "/usage",
          "/cli",
          // /share/<token> are private capability URLs — never crawl. Each
          // share page also returns <meta name="robots" content="noindex">
          // for engines that ignore robots.txt for already-known URLs.
          "/share/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
