# 2026-05-05 — GEO foundation: AI-aware robots.txt + llms.txt

## Goal

Make Knosi's content discoverable and accurately citable by AI search
engines (ChatGPT, Claude, Perplexity, Copilot) without feeding the
training-only crawlers. Inspired by Tw93's
[GEO writeup](https://x.com/HiTw93/status/2050189572999618982) and the
research it cites.

## What changed

- **`src/app/robots.ts`** — replaced single `User-agent: *` rule with
  classified rules. Default `*` keeps the existing private-route
  disallow list. Explicit allow rules for search/retrieval bots
  (`OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`,
  `Perplexity-User`, classic search bots) and user-triggered fetchers
  (`ChatGPT-User`, `Claude-User`, `Google-Agent`). Explicit block
  rules for training-only crawlers (`GPTBot`, `ClaudeBot`,
  `Meta-ExternalAgent`, `CCBot`, `anthropic-ai`, `cohere-ai`,
  `FacebookBot`, `Amazonbot`), opt-out tokens (`Google-Extended`,
  `Applebot-Extended`), and known undeclared scrapers (`Bytespider`,
  `ImagesiftBot`, `Diffbot`).
- **`public/llms.txt`** — new short overview (~3 KB). Project name,
  one-line description, key links (landing, pricing, GitHub, README,
  llms-full), feature highlights, tech stack, author, license.
- **`public/llms-full.txt`** — new long-form AI context (~22 KB).
  Project narrative, full module / feature inventory derived from
  `src/components/layout/navigation.ts` and the README, hosted vs
  self-hosted, tech stack, architecture, quick start (Docker / local /
  Hetzner), configuration overview (required env, auth, S3, feature
  flags, AI rate limit), AI provider setup, Claude Code Daemon, Claude
  Web MCP connector, save-to-Knosi flow, project structure, privacy
  posture, AI crawler policy, FAQ, author and contact, license,
  canonical URL list.
- **`src/app/sitemap.ts`** — added `/llms.txt` and `/llms-full.txt` so
  retrieval crawlers can discover the AI-readable descriptors without
  relying on directory listings or naming conventions.

## Files

- `src/app/robots.ts` (rewritten)
- `src/app/sitemap.ts` (added two entries)
- `public/llms.txt` (new)
- `public/llms-full.txt` (new)
- `docs/changelog/2026-05-05-geo-llms-txt.md` (this file)

## Verification

- `pnpm build` ✅ — production build compiles, `/robots.txt` and
  `/sitemap.xml` listed in the route manifest, no schema or runtime
  regressions.
- `pnpm lint` — pre-existing 18 errors in unrelated files (Tiptap
  editor `react-hooks/refs` warnings, etc.). The four files touched
  in this changeset produce zero new lint errors. Confirmed via
  `pnpm lint 2>&1 | grep -E "(robots|sitemap)"` returning no output.
- `pnpm test:e2e` — skipped per worktree convention
  (`feedback_skip_e2e_in_worktrees.md`); E2E gate runs on main /
  pre-merge.

## Why these specific choices

- **Default `*` mirrors the previous policy** rather than blocking all
  unknown crawlers. Many well-behaved bots (Linkedin preview, Slack
  unfurl, Discord embed, Mastodon previewer) do not declare AI-related
  intent, and blocking them would break link previews and reduce
  third-party visibility — which the research cited in Tw93's piece
  identifies as the single highest-leverage AI citation signal
  (third-party references are 6.5× more weighty than self-references).
- **Allowed agents include both `Bingbot` and AI search bots.** Bing
  powers Copilot, DuckDuckGo, Yahoo, and is a recall fallback for some
  Perplexity flows. Even if you do not care about Bing's human users,
  Bing's index is an upstream for several AI products.
- **Blocked training crawlers, including `ClaudeBot` and `GPTBot`,
  even though we route Ask AI through Claude.** Knosi is AGPL — opt
  out of model training is the consistent default. This is independent
  from the user's own choice to ingest specific notes into a model
  inside the app.
- **`llms-full.txt` size: 22 KB**, in the 30–60 KB target band's lower
  half. The doc is comprehensive but not padded; we'd rather grow it
  organically with real product changes than ship filler text now.
- **Sitemap `priority: 0.7` for the llms files** — below the landing
  page (1.0) and pricing (0.8), above legal pages (0.3). Search
  engines treat priority as a relative hint within a sitemap.

## Follow-ups (out of scope here, manual)

These cannot be automated from the repo:

1. **Google Search Console** — verify `knosi.xyz` via DNS TXT, submit
   `https://www.knosi.xyz/sitemap.xml`, confirm the new llms-* URLs
   appear under "Pages" once Google recrawls.
2. **Bing Webmaster Tools** — register, verify, submit sitemap, and
   enable IndexNow. Bing also surfaces an AI Performance dashboard
   showing how often our content is cited inside Copilot answers.
3. **IndexNow integration** — drop the API key file in `public/`,
   then add a step to `.github/workflows/deploy-hetzner.yml` that
   POSTs the changed URLs to `api.indexnow.org/indexnow` after a
   successful deploy. Optional but cuts Bing's crawl-discovery lag
   from days to minutes.
4. **`knosi.xyz` → `www.knosi.xyz` 301** — confirm the apex domain
   redirects to the canonical `www` host at the Caddy / Cloudflare
   layer. Our `metadataBase` and sitemap canonicalize on `www`, so
   external links to the apex must redirect, not duplicate the index.
5. **Submit to AI directories** — `directory.llmstxt.cloud`,
   `llmstxt.site`, and the `llms-txt-hub` GitHub repo PR.
6. **Third-party visibility** — Show HN, Product Hunt, Reddit
   (`r/selfhosted`, `r/ClaudeAI`). The research consensus is that
   third-party citations carry far more weight than first-party
   ones, so this is the highest-leverage manual step.

## Why we did NOT do certain things

- **No `<meta name="llms">` or `/.well-known/ai.txt`.** No mainstream
  AI system supports either; multiple competing proposals exist with
  no winner. Adding them is noise.
- **No User-Agent sniffing to return Markdown.** Returning different
  content to bots vs. users is cloaking and is penalized by Google.
- **No new FAQ section on landing.** The research cited in Tw93's
  writeup found FAQ-formatted content underperforms long-form
  explanations and acts as a negative signal for several AI search
  systems. The existing 7-item FAQ on `/` (kept primarily for the
  `FAQPage` JSON-LD it produces, which still helps Google AI Overview)
  is sufficient.
- **No JSON-LD additions for the llms files.** SearchVIU's experiment
  showed LLMs treat `<script type="application/ld+json">` as plain
  text rather than parsing the structured semantics — there is no
  marginal lift from adding JSON-LD for this purpose.

## References

- Tw93, "GEO: making your content visible to AI search engines",
  https://x.com/HiTw93/status/2050189572999618982
- Princeton & IIT Delhi, "GEO: Generative Engine Optimization", KDD 2024
- llms.txt standard: https://llmstxt.org
- Ahrefs, "Why ChatGPT cites one page over another"
- SE Ranking, "LLMs.txt adoption study"
- Mintlify, "How often do LLMs visit llms.txt?"
- IndexNow protocol: https://www.indexnow.org/documentation
