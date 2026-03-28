## 2026-03-28

### Task / Goal

Unify outward-facing product copy to English across the primary user flows, including navigation, authentication, notes, settings, and Ask AI.

### Key Changes

- Translated shared navigation and brand copy to English across desktop and mobile layouts.
- Updated personalized workspace labels and homepage greeting copy to English.
- Translated visible UI copy on login, register, notes, note editor, bookmarks, settings, search, and Ask AI pages.
- Switched Ask AI scope labels and descriptions to English while keeping the reduced visible scope set.
- Updated outward-facing metadata descriptions to English.

### Files Touched

- `src/app/(app)/page.tsx`
- `src/app/(app)/ask/page.tsx`
- `src/app/(app)/bookmarks/page.tsx`
- `src/app/(app)/notes/page.tsx`
- `src/app/(app)/notes/[id]/page.tsx`
- `src/app/(app)/settings/page.tsx`
- `src/app/layout.tsx`
- `src/app/login/page.tsx`
- `src/app/register/page.tsx`
- `src/app/manifest.ts`
- `src/components/layout/app-brand.tsx`
- `src/components/layout/mobile-nav.tsx`
- `src/components/layout/navigation.ts`
- `src/components/layout/sidebar.tsx`
- `src/components/layout/workspace-label.ts`
- `src/components/search-dialog.tsx`
- `src/lib/ask-ai.ts`
- `src/lib/note-appearance.ts`
- `src/lib/note-templates.ts`

### Verification Commands And Results

- `pnpm lint` — passed
- `pnpm build` — passed
- `pnpm exec node <<'NODE' ... NODE` against `http://localhost:3000` — desktop navigation, homepage CTA, Ask AI scope labels, and notes page title rendered in English; existing note content and saved note titles still surfaced older Chinese user data in the page text dump
- `PORT=3001 pnpm start` — app booted successfully, but production-mode smoke login on `localhost:3001` was blocked by Auth.js `UntrustedHost`, so alternate-port browser verification could not be completed

### Remaining Risks / Follow-up

- Secondary pages such as `explore`, `todos`, and `usage` may still contain Chinese copy and were not part of this pass.
- Existing user-generated note titles and note bodies remain unchanged, so browser text dumps can still contain Chinese even when the surrounding UI is English.
- The long-running `next dev` instance showed old hydration-mismatch log entries during this pass; if the local dev UI still shows stale workspace text, restart `pnpm dev` once to clear the old server render cache.
