import { DOMParser } from "linkedom";

export type PortfolioAssetType = "stock" | "crypto";

export interface PortfolioNewsSearchInput {
  symbol: string;
  name?: string | null;
  assetType?: PortfolioAssetType | null;
}

export interface PortfolioNewsArticle {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  snippet: string;
}

const GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search";
const RECENT_NEWS_WINDOW_MS = 72 * 60 * 60 * 1000;

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildAssetHints(assetType?: PortfolioAssetType | null) {
  if (assetType === "crypto") {
    return ["crypto", "token", "coin", "blockchain"];
  }

  return ["stock", "shares", "nasdaq", "nyse"];
}

export function buildPortfolioNewsSearchQueries({
  symbol,
  name,
  assetType,
}: PortfolioNewsSearchInput) {
  const normalizedSymbol = normalizeWhitespace(symbol).toUpperCase();
  const normalizedName = normalizeWhitespace(name ?? "");
  const hints = buildAssetHints(assetType);
  const queries = new Set<string>();

  const pushQuery = (parts: Array<string | null | undefined>) => {
    const query = normalizeWhitespace(parts.filter(Boolean).join(" "));
    if (query) {
      queries.add(query);
    }
  };

  if (normalizedName && normalizedName.toUpperCase() !== normalizedSymbol) {
    pushQuery([`"${normalizedName}"`, `"${normalizedSymbol}"`, hints[0], hints[1]]);
    pushQuery([`"${normalizedName}"`, hints[0], hints[1]]);
  }

  pushQuery([`"${normalizedSymbol}"`, hints[0], hints[1], hints[2], hints[3]]);

  return [...queries];
}

function extractTextContent(rawHtml: string) {
  const doc = new DOMParser().parseFromString(rawHtml, "text/html");
  return normalizeWhitespace(doc.documentElement.textContent ?? "");
}

export function parseGoogleNewsRss(xml: string): PortfolioNewsArticle[] {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const items = Array.from(doc.querySelectorAll("item") as ArrayLike<Element>);
  const deduped = new Map<string, PortfolioNewsArticle>();

  for (const item of items) {
    const title = normalizeWhitespace(item.querySelector("title")?.textContent ?? "");
    const link = normalizeWhitespace(item.querySelector("link")?.textContent ?? "");
    const source = normalizeWhitespace(item.querySelector("source")?.textContent ?? "Google News");
    const pubDate = normalizeWhitespace(item.querySelector("pubDate")?.textContent ?? "");
    const description = item.querySelector("description")?.textContent ?? "";

    if (!title || !link || !pubDate) {
      continue;
    }

    const publishedAtDate = new Date(pubDate);
    if (Number.isNaN(publishedAtDate.getTime())) {
      continue;
    }

    const article: PortfolioNewsArticle = {
      title,
      link,
      source,
      publishedAt: publishedAtDate.toISOString(),
      snippet: extractTextContent(description),
    };

    deduped.set(`${title}::${link}`, article);
  }

  return [...deduped.values()].sort((left, right) => (
    right.publishedAt.localeCompare(left.publishedAt)
  ));
}

export async function fetchRecentPortfolioNewsArticles(
  input: PortfolioNewsSearchInput,
  fetchImpl: typeof fetch = fetch
) {
  const now = Date.now();
  const recentArticles = new Map<string, PortfolioNewsArticle>();
  const fallbackArticles = new Map<string, PortfolioNewsArticle>();

  for (const query of buildPortfolioNewsSearchQueries(input)) {
    const url = new URL(GOOGLE_NEWS_RSS_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("hl", "en-US");
    url.searchParams.set("gl", "US");
    url.searchParams.set("ceid", "US:en");

    const response = await fetchImpl(url.toString(), {
      headers: {
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9,*/*;q=0.8",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      continue;
    }

    const xml = await response.text();
    const articles = parseGoogleNewsRss(xml);

    for (const article of articles) {
      const dedupeKey = `${article.title}::${article.link}`;
      fallbackArticles.set(dedupeKey, article);

      if (now - new Date(article.publishedAt).getTime() <= RECENT_NEWS_WINDOW_MS) {
        recentArticles.set(dedupeKey, article);
      }
    }

    if (recentArticles.size >= 6) {
      break;
    }
  }

  const articles = recentArticles.size > 0 ? recentArticles : fallbackArticles;
  return [...articles.values()].slice(0, 6);
}
