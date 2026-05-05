# GEO TODO — making Knosi visible to AI search engines

Context: code-level GEO foundation landed in `f5faf0f`
(see `docs/changelog/2026-05-05-geo-llms-txt.md`). The items below
cannot be automated from the repo and require manual action or
external accounts. Ordered by leverage / cost ratio.

---

## 🔥 This week — high leverage, mostly < 10 minutes each

### 1. Google Search Console

- [ ] Sign in at https://search.google.com/search-console
- [ ] Add property `knosi.xyz` (the bare apex — covers both apex and `www`)
- [ ] Verify via DNS TXT record (Cloudflare DNS panel)
- [ ] Submit sitemap: `https://www.knosi.xyz/sitemap.xml`
- [ ] Open "Pages" report, request manual indexing for any
      important page that shows as "Not indexed"
- [ ] Note: GSC has no AI-specific dashboard, but Google AI
      Overview pulls from the same index, so getting indexed is
      table stakes.

### 2. Bing Webmaster Tools (more important than GSC for AI)

Bing powers Copilot, DuckDuckGo, Yahoo AI search, and is a recall
fallback for some Perplexity flows. It's the one place you can
actually see how often AI cites you.

- [ ] Sign in at https://www.bing.com/webmasters
- [ ] Add and verify `https://www.knosi.xyz`
- [ ] Submit sitemap: `https://www.knosi.xyz/sitemap.xml`
- [ ] Enable **IndexNow** in the settings panel — copy the API key
- [ ] Save the API key somewhere — needed for task #6 below
- [ ] Bookmark the **AI Performance** dashboard. This is the only
      surface that reports how many times Knosi was cited inside
      Copilot answers. Check weekly.

### 3. Confirm apex → www 301 redirect

`metadataBase`, sitemap, and llms.txt all canonicalize on
`www.knosi.xyz`. If `knosi.xyz` (apex) doesn't 301, AI sees two
domains with the same content and splits authority.

- [ ] Run: `curl -sI https://knosi.xyz | grep -i location`
- [ ] Expected: `location: https://www.knosi.xyz/`
- [ ] If missing, add a Cloudflare Redirect Rule (Rules → Redirect Rules):
      - When: `Hostname equals knosi.xyz`
      - Then: `Static → 301 → https://www.knosi.xyz${request.uri.path}`

---

## 🚀 Next week — medium leverage

### 4. Submit to AI / llms.txt directories

First-mover advantage; only ~10% of domains have llms.txt yet.

- [ ] https://directory.llmstxt.cloud — submit form
- [ ] https://llmstxt.site — submit form
- [ ] https://github.com/thedaviddias/llms-txt-hub — open PR adding Knosi
- [ ] https://aifind.org — general AI tool directory
- [ ] https://aitop100.com — general AI tool directory

### 5. Third-party visibility (the highest-leverage step)

Research consensus: third-party citations carry **6.5×** more
weight than self-references. This single category outweighs every
technical configuration combined.

- [ ] **Show HN** — title: "Show HN: Knosi – Self-hosted AI second
      brain that uses your Claude Pro subscription".
      Best slot: Tue/Wed 8–10am PT.
      Prep a top-of-thread comment with the "why I built this" story.
- [ ] **Product Hunt** — Tuesday launches do best; line up a
      hunter ahead of time so the launch isn't cold.
- [ ] **Reddit** (post one per week, not all at once):
  - [ ] r/selfhosted — best fit, lead with the Hetzner Docker stack
  - [ ] r/ClaudeAI — lead with the Claude Code Daemon
  - [ ] r/SaaS or r/sideproject — lead with the AGPL + hosted-Pro split
  - [ ] r/PKMS or r/Notion — lead with the editor + RAG combo
- [ ] **X / Twitter** — write one launch thread, pin to profile
- [ ] **HN comment seeding** — answer when Knosi could legitimately
      help in r/ClaudeAI, r/selfhosted, HN threads on note-taking
      or RAG. Drive-by promo gets rejected; honest answers stick.

### 6. IndexNow integration (automate Bing crawl-discovery)

Once IndexNow is enabled in Bing Webmaster Tools (task #2):

- [ ] Drop the API key file at `public/<key>.txt` (Bing tells you
      the exact filename — must match the key)
- [ ] Add a step to `.github/workflows/deploy-hetzner.yml` after
      the deploy step:
      ```yaml
      - name: Notify IndexNow
        run: |
          curl -X POST "https://api.indexnow.org/indexnow" \
            -H "Content-Type: application/json" \
            -d '{
              "host": "www.knosi.xyz",
              "key": "${{ secrets.INDEXNOW_KEY }}",
              "urlList": [
                "https://www.knosi.xyz/",
                "https://www.knosi.xyz/llms.txt",
                "https://www.knosi.xyz/llms-full.txt",
                "https://www.knosi.xyz/pricing"
              ]
            }'
      ```
- [ ] Add `INDEXNOW_KEY` to GitHub repo secrets
- [ ] Cuts Bing's crawl-discovery lag from days to minutes after
      every push to main.

---

## 💎 Long-term — leverage but not urgent

### 7. Align README and landing page depth

Current asymmetry: README is 463 lines of detail; landing is mostly
a hero + features grid. AI scrapes the GitHub README and gets more
information than scraping knosi.xyz, which is backwards.

- [ ] Add a `/about` or `/docs/features` page on knosi.xyz with the
      same depth as the README (modules, tech stack, architecture,
      self-host story)
- [ ] Don't shrink the README — instead lift the landing surface
- [ ] Keep landing-page first impression light; deep content lives
      one click in

### 8. Monitor (one month after deploy)

- [ ] Search ChatGPT, Claude, Perplexity for:
  - `knosi`
  - `self-hosted second brain`
  - `Claude Pro knowledge management`
  - `claude code save notes`
- [ ] Compare AI's description of Knosi against the actual
      `llms.txt` and `llms-full.txt` content. If wrong, update
      those files (`public/llms*.txt`).
- [ ] Bing Webmaster AI Performance dashboard — track citation
      count week over week.

---

## ❌ Do NOT do

These are tempting but actively harmful or zero-impact:

- ❌ Add more FAQ content. Research cited in the GEO writeup found
      FAQ format underperforms long-form explanations and acts as a
      negative signal in several AI search systems. The existing
      7-item FAQ on `/` is kept only because it powers the
      `FAQPage` JSON-LD that helps Google AI Overview specifically.
- ❌ User-Agent sniffing to return Markdown for AI bots. That is
      cloaking — Google penalizes it.
- ❌ `<meta name="llms">`, `<meta name="ai-content-url">`, or
      `/.well-known/ai.txt`. No mainstream AI system supports them.
- ❌ HTML comments containing AI hints. Parsers strip comments
      before the model sees the content.
- ❌ JSON-LD added specifically to boost AI citation. SearchVIU's
      experiment showed LLMs treat `<script type="application/ld+json">`
      as plain text rather than parsing the structured semantics.
- ❌ Buying paid SEO audit tools and chasing their score.
- ❌ Spending more than ~one focused day on this. Product itself
      is the moat; GEO is a thin layer of polish on top.

---

## References

- Tw93, "GEO: making your content visible to AI search engines",
  https://x.com/HiTw93/status/2050189572999618982
- Princeton & IIT Delhi, "GEO: Generative Engine Optimization", KDD 2024
- llms.txt standard: https://llmstxt.org
- IndexNow protocol: https://www.indexnow.org/documentation
- Code-level changelog: `docs/changelog/2026-05-05-geo-llms-txt.md`
