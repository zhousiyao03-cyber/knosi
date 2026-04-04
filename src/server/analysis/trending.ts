import * as cheerio from "cheerio";

export interface TrendingRepo {
  fullName: string;
  description: string;
  language: string | null;
  stars: number;
  periodStars: number;
  url: string;
}

type TrendingSince = "daily" | "weekly" | "monthly";

interface CacheEntry {
  data: TrendingRepo[];
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CacheEntry>();

function cacheKey(since: TrendingSince, language: string) {
  return `${since}:${language}`;
}

function parseStarCount(text: string): number {
  const cleaned = text.trim().replace(/,/g, "");
  if (cleaned.endsWith("k")) {
    return Math.round(parseFloat(cleaned) * 1000);
  }
  return parseInt(cleaned, 10) || 0;
}

export async function fetchTrending(
  since: TrendingSince = "daily",
  language = ""
): Promise<TrendingRepo[]> {
  const key = cacheKey(since, language);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const params = new URLSearchParams({ since });
  if (language) {
    params.set("language", language);
  }

  const url = `https://github.com/trending?${params}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SecondBrain/1.0)",
      Accept: "text/html",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub trending fetch failed: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const repos: TrendingRepo[] = [];

  $("article.Box-row").each((_, el) => {
    const $el = $(el);
    const fullName = $el.find("h2 a").attr("href")?.slice(1)?.trim() ?? "";
    if (!fullName) return;

    const description = $el.find("p").first().text().trim();
    const languageEl = $el.find('[itemprop="programmingLanguage"]');
    const language = languageEl.length ? languageEl.text().trim() : null;

    const starLinks = $el.find("a.Link--muted");
    const starsText = starLinks.first().text().trim();
    const stars = parseStarCount(starsText);

    const periodStarsText = $el.find(".float-sm-right, .d-inline-block.float-sm-right").text().trim();
    const periodStarsMatch = periodStarsText.match(/([\d,]+)\s+stars?\s+/i);
    const periodStars = periodStarsMatch ? parseInt(periodStarsMatch[1].replace(/,/g, ""), 10) : 0;

    repos.push({
      fullName,
      description,
      language,
      stars,
      periodStars,
      url: `https://github.com/${fullName}`,
    });
  });

  cache.set(key, { data: repos, timestamp: Date.now() });
  return repos;
}
