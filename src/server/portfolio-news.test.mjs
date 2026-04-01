import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPortfolioNewsSearchQueries,
  parseGoogleNewsRss,
} from "./portfolio-news.ts";

test("buildPortfolioNewsSearchQueries uses holding name to disambiguate ambiguous stock symbols", () => {
  const queries = buildPortfolioNewsSearchQueries({
    symbol: "JD",
    name: "京东",
    assetType: "stock",
  });

  assert.ok(queries.length > 0);
  assert.match(queries[0], /JD/);
  assert.match(queries[0], /京东/);
  assert.match(queries[0], /stock|shares|nasdaq|nyse/i);
});

test("buildPortfolioNewsSearchQueries adds crypto hints for tokens", () => {
  const queries = buildPortfolioNewsSearchQueries({
    symbol: "BTC",
    name: "Bitcoin",
    assetType: "crypto",
  });

  assert.ok(queries.some((query) => /crypto|token|coin|blockchain/i.test(query)));
  assert.ok(queries.some((query) => /Bitcoin/i.test(query)));
});

test("parseGoogleNewsRss extracts article title, source, link, and published time", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <item>
        <title>JD.com launches new same-day delivery program</title>
        <link>https://news.google.com/rss/articles/CBMiQ2h0dHBzOi8vZXhhbXBsZS5jb20vamQtbmV3cy1kZWxpdmVyeS1wcm9ncmFt0gEA</link>
        <pubDate>Tue, 01 Apr 2026 10:30:00 GMT</pubDate>
        <source url="https://example.com">Reuters</source>
        <description><![CDATA[<div>JD.com expanded delivery coverage in key cities.</div>]]></description>
      </item>
    </channel>
  </rss>`;

  const articles = parseGoogleNewsRss(xml);

  assert.equal(articles.length, 1);
  assert.equal(articles[0].title, "JD.com launches new same-day delivery program");
  assert.equal(articles[0].source, "Reuters");
  assert.equal(
    articles[0].link,
    "https://news.google.com/rss/articles/CBMiQ2h0dHBzOi8vZXhhbXBsZS5jb20vamQtbmV3cy1kZWxpdmVyeS1wcm9ncmFt0gEA"
  );
  assert.equal(articles[0].publishedAt, "2026-04-01T10:30:00.000Z");
  assert.match(articles[0].snippet, /expanded delivery coverage/i);
});
