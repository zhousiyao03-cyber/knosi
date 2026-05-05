import type { MetadataRoute } from "next";

const SITE_URL = "https://www.knosi.xyz";

// Routes that must never be indexed by anyone (auth-gated, private, or capability URLs).
// Each /share/<token> page additionally returns <meta name="robots" content="noindex">
// for engines that ignore robots.txt on already-known URLs.
const PRIVATE_DISALLOW = [
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
  "/share/",
];

// Crawlers we welcome on public pages: classic search engines + AI search/retrieval
// (cite us in answers) + user-triggered fetchers (user pastes our URL into a chat).
const ALLOWED_AGENTS = [
  // Classic search
  "Googlebot",
  "Bingbot",
  "DuckDuckBot",
  // AI search & retrieval
  "OAI-SearchBot",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  // User-triggered fetchers
  "ChatGPT-User",
  "Claude-User",
  "Google-Agent",
];

// Crawlers we block: training-only bots (we're AGPL — opt out of model training)
// and undeclared / non-compliant scrapers.
const BLOCKED_AGENTS = [
  // Training crawlers
  "GPTBot",
  "ClaudeBot",
  "Meta-ExternalAgent",
  "CCBot",
  "anthropic-ai",
  "cohere-ai",
  "FacebookBot",
  "Amazonbot",
  // Opt-out tokens (signal to Google/Apple: don't use us in AI training)
  "Google-Extended",
  "Applebot-Extended",
  // Undeclared / non-compliant
  "Bytespider",
  "ImagesiftBot",
  "Diffbot",
];

export default function robots(): MetadataRoute.Robots {
  const allowRules = ALLOWED_AGENTS.map((userAgent) => ({
    userAgent,
    allow: ["/"],
    disallow: PRIVATE_DISALLOW,
  }));

  const blockRules = BLOCKED_AGENTS.map((userAgent) => ({
    userAgent,
    disallow: ["/"],
  }));

  return {
    rules: [
      // Default: same policy as classic search bots — allow public pages,
      // disallow private/auth-gated routes. Keeps unknown well-behaved bots working.
      {
        userAgent: "*",
        allow: ["/"],
        disallow: PRIVATE_DISALLOW,
      },
      ...allowRules,
      ...blockRules,
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
