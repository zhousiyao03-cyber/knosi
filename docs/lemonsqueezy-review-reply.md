# Lemon Squeezy KYB/KYC Review — Reply Package

This file is a handoff for responding to Lemon Squeezy's review request
(Ankith, review email received 2026-04-24). It contains:

1. What's already done in the repo (ready to deploy).
2. What you still need to do by hand (demo video, social links).
3. A ready-to-send email reply.
4. A pricing one-pager to paste into the reply.
5. A 3-minute demo video recording script.

---

## 1. What's already done in-repo

Committed pages, reachable after the next `git push` auto-deploy:

| Requirement | URL | Source |
| --- | --- | --- |
| Terms of Service | `https://www.knosi.xyz/legal/terms` | `src/app/legal/terms/page.tsx` |
| Privacy Policy | `https://www.knosi.xyz/legal/privacy` | `src/app/legal/privacy/page.tsx` |
| Refund Policy | `https://www.knosi.xyz/legal/refund` | `src/app/legal/refund/page.tsx` |
| Pricing page (already existed) | `https://www.knosi.xyz/pricing` | `src/app/pricing/page.tsx` |

All three legal pages are linked from:

- Landing page footer (`src/components/marketing/landing-page.tsx`)
- Pricing page footer (`src/app/pricing/page.tsx`)
- Each legal page's own header (cross-links between Terms / Privacy / Refund)

Sitemap (`src/app/sitemap.ts`) updated to include the new routes.

**Refund Policy summary (what reviewers care about):** 14-day money-back
guarantee for first-time Pro subscribers, cancel anytime from
Settings → Billing, email-based refund process through `support@knosi.xyz`.

---

## 2. What you still need to do by hand

### a. Demo video (unlisted YouTube or Loom link)

Follow the script in Section 5 below. 2–5 minutes is the sweet spot. Don't
over-produce it — reviewers just want to see the product works and that
money goes somewhere real.

### b. Personal social media URLs for KYB/KYC

At minimum provide:

- LinkedIn (most important — make sure profile picture, current role,
  and some activity exist)
- One of: X/Twitter, GitHub

If any are sparse, add a couple of posts or a bio line before sending.

### c. `support@knosi.xyz` email

The refund / privacy / terms pages all say to email `support@knosi.xyz`.
Make sure this address actually delivers to you. If it doesn't exist yet,
set up a catch-all / forward on your domain before replying to Lemon
Squeezy — reviewers sometimes test it.

### d. Deploy

Push to `main`, GitHub Actions auto-deploys to Hetzner. Smoke-check the
three legal URLs return 200 before replying.

```bash
curl -I https://www.knosi.xyz/legal/terms
curl -I https://www.knosi.xyz/legal/privacy
curl -I https://www.knosi.xyz/legal/refund
```

---

## 3. Email reply — ready to send

> Paste this into the Lemon Squeezy reply. Fill in the `[…]` placeholders
> (video link, social URLs) before sending.

---

Subject: Re: Knosi — additional information

Hi Ankith,

Thanks for the review and for getting back quickly. Please find the requested information below.

**1. Pricing**

- Product: Knosi — a web-based personal knowledge management (PKM) app with AI-assisted note-taking and Q&A.
- Plans offered through Lemon Squeezy:
  - Free: $0. 20 Ask AI calls/day (bring your own provider), 50 notes, 100 MB image storage, 3 share links, full editor.
  - Pro Monthly: $9/month (USD), auto-renewing.
  - Pro Annual: $90/year (USD), auto-renewing. (Same as $7.50/month — ~17% off vs. monthly.)
- All plans are recurring subscriptions. No one-time purchases, no digital downloads, no marketplace.
- Pro includes: 80 Ask AI calls/day (Knosi AI included), unlimited notes, 10 GB image storage, unlimited share links, Portfolio Tracker, Focus Tracker, OSS Projects, Claude Capture, priority support.
- Public pricing page: https://www.knosi.xyz/pricing

**2. Demo video**

[INSERT UNLISTED YOUTUBE OR LOOM LINK]

The video walks through sign-up, note editing, Ask AI (RAG across the user's own notes), and the upgrade / checkout flow.

**3. Personal social accounts (for KYB/KYC)**

- LinkedIn: [INSERT LINKEDIN URL]
- GitHub: [INSERT GITHUB URL]
- X/Twitter: [INSERT OR DELETE]

**4. Product details**

Knosi is a SaaS personal knowledge management platform for individual knowledge workers, students, researchers, and developers. Users create notes in a rich block editor (Markdown, tables, code blocks, Mermaid diagrams, Excalidraw sketches) and can ask AI questions across their own notes using retrieval-augmented generation. The software is developed and operated by us; access is sold as a recurring monthly or annual subscription under a proprietary hosted license. Access is tied 1:1 to an account — there is no user-to-user marketplace and we do not resell third-party content. An open-source self-hosted version is available separately for users who prefer to run the software on their own infrastructure.

**5. Legal pages**

The landing page footer and the pricing page footer now include clearly visible links to all three documents:

- Terms of Service: https://www.knosi.xyz/legal/terms
- Privacy Policy: https://www.knosi.xyz/legal/privacy
- Refund Policy: https://www.knosi.xyz/legal/refund

The Refund Policy states a 14-day money-back guarantee for first-time Pro subscribers, describes how to cancel a subscription, how to request a refund via `support@knosi.xyz`, and preserves statutory consumer rights (e.g., EU right of withdrawal).

Let me know if anything else is needed to move the review forward.

Best,
Siyao

---

## 4. Pricing one-pager (compact version)

If Ankith asks for "a breakdown in a cleaner format" you can also paste
this table:

| Plan | Price | Billing | Ask AI / day | Notes | Image storage | Extras |
| --- | --- | --- | --- | --- | --- | --- |
| Free | $0 | — | 20 (BYO provider) | 50 | 100 MB | Core editor, tags, search, 3 share links |
| Pro Monthly | $9 USD | Monthly, auto-renew | 80 (Knosi AI included) | Unlimited | 10 GB | Portfolio, Focus, OSS Projects, Claude Capture, priority support |
| Pro Annual | $90 USD | Annual, auto-renew | 80 (Knosi AI included) | Unlimited | 10 GB | Same as Pro Monthly, ~17% off |

Payment processor & merchant of record: Lemon Squeezy. Refund: 14-day
money-back on first-time Pro purchases. Cancel anytime.

---

## 5. Demo video recording script (2–4 minutes)

> Record in 1080p. Zoom the browser to 110–125%. Turn off personal
> notifications. Pick a fresh test account so the screen isn't full of your
> personal notes.

### Shot list

**[0:00–0:15] Intro** — Open https://www.knosi.xyz. Read the tagline
aloud: *"Knosi is a personal knowledge management app that turns AI
conversations into notes you own."*

**[0:15–0:40] Sign up** — Click **Sign up**, register a test account. Show
you land on `/dashboard`. Briefly narrate: *"New users start with a 7-day
Pro trial."*

**[0:40–1:20] Create a note** — Open `/notes`, click **New note**. Type a
title. In the body:

- Type `/` to show the slash-command menu, insert a code block.
- Type `/` again, insert a Mermaid diagram (flowchart or simple pipeline).
- Add a callout block.

Narrate: *"Users write in a rich block editor with code, diagrams,
callouts, tables, and more."*

**[1:20–2:00] Ask AI** — Open `/ask`. Ask a question about the note you
just wrote (e.g., "summarize my pipeline note"). Show the streamed
response. Narrate: *"Ask AI runs retrieval over your own notes, not the
public internet — you get grounded answers based on what you've saved."*

**[2:00–2:40] Pricing + checkout** — Navigate to `/pricing`. Read the two
plans aloud briefly. Click **Upgrade to Pro** — this opens Lemon Squeezy
checkout. Narrate: *"Subscriptions are handled by Lemon Squeezy. Monthly
or annual, auto-renewing, cancel any time."* You do NOT need to complete
the purchase on camera. Just show the checkout modal so reviewers see it
integrates with them.

**[2:40–3:00] Legal footer** — Scroll to the footer on the landing page.
Zoom in on the Terms / Privacy / Refund links. Click into the Refund
Policy so reviewers see the 14-day guarantee text. Narrate:
*"Terms, Privacy, and a 14-day money-back refund policy are linked from
every public page."*

**[3:00] End.** No outro music needed.

### Upload checklist

- YouTube: upload as **Unlisted** (not Public, not Private). Paste the
  unlisted URL in the reply.
- Loom: set visibility to **Anyone with the link can view**. Disable
  comments if you want.

---

## 6. Files changed in this task

- `src/app/legal/layout.tsx` (new)
- `src/app/legal/terms/page.tsx` (new)
- `src/app/legal/privacy/page.tsx` (new)
- `src/app/legal/refund/page.tsx` (new)
- `src/app/pricing/page.tsx` (updated — footer + refund note)
- `src/components/marketing/landing-page.tsx` (updated — legal links in footer)
- `src/app/sitemap.ts` (updated — 4 new entries)
- `e2e/legal.spec.ts` (new — will run on next CI)
- `docs/lemonsqueezy-review-reply.md` (this file)

## 7. Verification

- `npx eslint src/app/legal src/app/pricing/page.tsx src/components/marketing/landing-page.tsx` — clean.
- `pnpm build` — pass. Three new pages are prerendered as static:
  `○ /legal/privacy`, `○ /legal/refund`, `○ /legal/terms`.
- E2E spec `e2e/legal.spec.ts` added; local Playwright run blocked by an
  unrelated Next 16 dev-server self-detection issue on Windows. Will run
  automatically in CI.
