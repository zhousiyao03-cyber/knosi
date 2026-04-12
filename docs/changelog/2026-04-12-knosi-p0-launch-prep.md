# P0 Launch Prep — Knosi Rebrand & Marketing Page

**Date:** 2026-04-12
**Task:** Complete all P0 blockers for public launch

## Key Changes

### 1. AGPL-3.0 License (`ef7c7ff`)
- Added `LICENSE` file with full AGPL-3.0 text
- Updated `package.json`: name → "knosi", license → "AGPL-3.0-or-later"
- Added license section to README.md

### 2. Brand Rename: Second Brain → Knosi (`4a0890c`)
- Root layout metadata (title, description, applicationName)
- AppBrand component text
- Login/register page titles
- Created `public/manifest.webmanifest`

### 3. Feature Flags System (`ef2440c`)
- New `src/lib/feature-flags.ts` with server + client flag readers
- Four flags: tokenUsage, portfolio, ossProjects, focusTracker (all default false)
- Updated `.env.example` with all flag env vars

### 4. Sidebar Narrative Grouping (`1d796d2`)
- `navigation.ts` restructured into NavGroup[] with CAPTURE / LEARN / TRACK / INSIGHTS sections
- Sidebar renders section headers (expanded) or dividers (collapsed)
- Mobile nav filters by feature flags
- Flat `navigationItems` export preserved for backward compat

### 5. Marketing Landing Page (`2933a96`, `ccf7e3a`)
- Dashboard moved from `/` to `/dashboard`
- New root `src/app/page.tsx`: session check → redirect to /dashboard or show landing
- New `src/components/marketing/landing-page.tsx`: hero, problem, features, tech stack, CTA
- All login/register redirects updated: `/` → `/dashboard`
- `proxy.ts`: added `/` to public paths so visitors see landing page

### 6. Token→Knowledge Dashboard Card (`51a8472`, `b30cd14`)
- Extended `dashboard.ts` router with monthly token stats (guarded by featureFlags.tokenUsage)
- Added Token→Knowledge card to dashboard client (tokens, notes created, conversion rate)

## Files Touched

- `LICENSE` (new)
- `public/manifest.webmanifest` (new)
- `src/app/page.tsx` (new — landing page router)
- `src/app/(app)/dashboard/page.tsx` (moved from `src/app/(app)/page.tsx`)
- `src/components/marketing/landing-page.tsx` (new)
- `src/lib/feature-flags.ts` (new)
- `src/app/layout.tsx`, `src/app/(app)/layout.tsx`
- `src/app/login/page.tsx`, `src/app/login/actions.ts`
- `src/app/register/page.tsx`, `src/app/register/actions.ts`
- `src/components/layout/navigation.ts`, `sidebar.tsx`, `mobile-nav.tsx`, `app-brand.tsx`
- `src/components/dashboard/dashboard-page-client.tsx`
- `src/server/routers/dashboard.ts`
- `src/proxy.ts`
- `package.json`, `.env.example`, `README.md`

## Verification

- `pnpm build`: PASS
- `pnpm lint`: PASS (0 errors, 4 pre-existing warnings)
- Landing page at `/` (unauthenticated): 200, renders hero + Knosi branding
- Protected routes `/dashboard`, `/notes`: 307 → `/login` (unauthenticated)

## Remaining / Follow-up

- P0.3 "一键从 Claude 保存" (Chrome extension / CLI) — separate project, not in this plan
- Landing page screenshots section — needs actual product screenshots
- GitHub repo URL in landing page — currently placeholder, update when repo is public
- proxy.ts Next.js 16 migration (recommended but not blocking)
