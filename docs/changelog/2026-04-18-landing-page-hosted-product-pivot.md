# 2026-04-18 — Landing page rewritten for hosted product

## Goal

The hosted version at knosi.xyz is live, but the landing page was still
written as if the only way to use Knosi was to self-host. Primary CTA said
"Start self-hosting" (linked to `/register` anyway), a "View demo" button
pointed to `/login` with no actual demo account, the nav GitHub link pointed
to a completely different repo (`nicholasgriffintn/second-brain`, which is
the original fork source), and two places still claimed Knosi deploys to
Vercel even though prod is Caddy + k3s on Hetzner.

Goal: reposition the page as "hosted product, self-hostable if you want" —
the real state — and add the structured-data SEO primitives that were on
the P0 follow-up list from this morning.

## Key changes

- `src/components/marketing/landing-data.ts` (new)
  - Extracted `GITHUB_URL` and `faqs` so the server component `page.tsx`
    and the `"use client"` landing component can both import them.
- `src/components/marketing/landing-page.tsx`
  - Fixed nav GitHub link that pointed to the wrong repo.
  - Reworked CTAs:
    - Nav: GitHub | Sign in | **Sign up** (primary, was "View demo")
    - Hero: **Get started — free** | View on GitHub
      (was "Start self-hosting" | "View demo")
    - Final CTA: **Get started — free** | View on GitHub
      (was "Start self-hosting" | "View GitHub")
  - Replaced Vercel mentions with accurate deploy story in the self-hosted
    feature card and the `#selfhost` section ("Docker, k3s, a single VPS,
    or your laptop").
  - Updated hero eyebrow from "Self-hosted · AI-native · Built for
    developers" to "AI-native · Built for developers · Self-hostable"
    (self-host is an option, not the headline).
  - Updated the sub-hero cost line to mention the hosted tier is free.
- `src/components/marketing/landing-data.ts`
  - Rewrote two FAQs:
    - "Do I need an API key?" now distinguishes hosted vs self-hosted.
    - "Can I self-host it?" now lists Docker / k3s / VPS / laptop; no more
      Vercel claim.
- `src/app/page.tsx` (server component)
  - Injects two JSON-LD blocks into the SSR output:
    - `SoftwareApplication` (name, description, url, image, category,
      `offers: { price: "0" }`, `sameAs: [GITHUB_URL]`)
    - `FAQPage` generated from the shared `faqs` array
  - Imports from `landing-data.ts` so the FAQ copy stays in one place.

## Files touched

- `src/app/page.tsx` — added JSON-LD blocks, imported shared data
- `src/components/marketing/landing-page.tsx` — nav / hero / self-host /
  final CTA / footer copy and link fixes
- `src/components/marketing/landing-data.ts` — new, shared data module
- `docs/changelog/2026-04-18-landing-page-hosted-product-pivot.md` — this file

## Verification

- `pnpm build` — clean, 0 errors.
- `pnpm exec eslint src/app/page.tsx src/components/marketing/` — clean.
- `pnpm lint` — skipped because the npm script hits the known Windows
  `mkdir -p` issue; running eslint directly on the changed paths is the
  executable substitute and comes back clean.
- `pnpm test:e2e` — skipped. The existing `e2e/seo.spec.ts` assertions
  (robots/sitemap content + `lang=en` + OG + canonical) were verified
  against a live dev server via `curl` against `http://localhost:3200`
  since the Windows EBUSY issue on `data/second-brain.e2e.db` still
  blocks the Playwright harness on this workstation:
  - `curl http://localhost:3200/robots.txt` — User-Agent + Allow + Disallow
    rules present.
  - `curl http://localhost:3200/sitemap.xml` — well-formed `<urlset>`,
    lists `https://www.knosi.xyz/`.
  - Rendered HTML on `/` contains `html lang="en"`, canonical
    `https://www.knosi.xyz`, `og:url` same, 0 Vercel mentions, 0
    `nicholasgriffintn` mentions, 7 hits of the correct
    `zhousiyao03-cyber/knosi` URL, and both
    `"@type":"SoftwareApplication"` + `"@type":"FAQPage"` JSON-LD blocks
    rendered into the initial SSR HTML.
  - CTAs in SSR HTML: 2× "Get started" (hero + final), 2× "View on
    GitHub", 1× "Sign in", 1× "Sign up". No "Start self-hosting" or
    "View demo" remnants.

## Follow-ups

- Add real product screenshots and wire them into a screenshot band under
  the hero. Will raise both conversion and SEO (alt text = indexable
  content). Needs the product under a clean demo account and a few posed
  screenshots.
- No production schema changes in this task.
