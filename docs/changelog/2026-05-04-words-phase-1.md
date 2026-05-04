# Words — Pronunciation Drill Phase 1 (2026-05-04)

## Goal
Pair `/speak` (sentence-level shadow drill) with `/words`, a word-level pronunciation drill that shows stress visualization, IPA, brief Chinese meaning, and one native example sentence per card. Users append their own words via an Add modal that calls AI to enrich on save.

## Key changes
- New tables `user_words` (composite PK `user_id, word_id`, unique idx on `user_id + text_normalized`, FK to users ON DELETE CASCADE) and `word_practice` (same shape as `speak_sentence_practice` but for words).
- New tRPC router `words` with `addWord` (`proProcedure`, calls AI), `listWords`, `recordPractice`, `getCounts`.
- New `/words` page: stress + IPA + zh meaning + example display, three TTS buttons (Word / Sentence / Next), keyboard `Space` / `S` / `→`, and a `+ Add word` modal.
- 100 hand-picked seed words in `src/lib/words/seed.ts` (stable IDs `w_001`–`w_100`). Each entry was authored directly against the spec criteria — General American IPA, ALL-CAPS·dot stress pattern, ≤12-hanzi single-sense Chinese meaning, 6–18 word working-professional casual example sentence. Mix: ~25 stress traps, ~20 silent-letter / vowel traps, ~10 mispronounced loans, ~25 working-vocab uplift, ~10 hedge / discourse markers, ~10 emotion / attitude / working-life verbs.
- AI enrichment helper `src/server/ai/words.ts` with structured-data prompt (prompted with both good and bad examples per field) and a `WORDS_E2E_MOCK=1` short-circuit so e2e doesn't burn tokens.
- Sidebar entry under LEARN with `BookOpen` icon, sits next to `/speak`.
- `scripts/words/generate-seed-enrichment.mjs` for future regeneration / extension of the seed list.
- E2E coverage in `e2e/words.spec.ts`: sidebar entry, Next changes word, Add modal flow + dedupe error, practice counter persists across reload.

## Files touched
- New: `src/server/db/schema/words.ts`, `src/server/routers/words.ts`, `src/server/ai/words.ts`, `src/lib/words/seed.ts`, `src/app/(app)/words/page.tsx`, `e2e/words.spec.ts`, `scripts/words/generate-seed-enrichment.mjs`, `scripts/db/apply-2026-05-04-words-rollout.mjs`, `docs/changelog/2026-05-04-words-phase-1.md`, `docs/superpowers/specs/2026-05-04-words-pronunciation-drill-design.md`, `docs/superpowers/plans/2026-05-04-words-pronunciation-drill.md`.
- Modified: `src/server/db/schema/index.ts`, `src/server/routers/_app.ts`, `src/components/layout/navigation.ts`, `playwright.config.ts`, `README.md`.
- Migration: `drizzle/0049_thankful_dexter_bennett.sql` + snapshot.

## Database changes
- `user_words (user_id text, word_id text, text text, text_normalized text, ipa text, stress_pattern text, meaning_zh text, example_en text, created_at integer, PK(user_id, word_id), FK user_id → users(id) ON DELETE CASCADE, UNIQUE(user_id, text_normalized))`
- `word_practice (user_id text, word_id text, count integer DEFAULT 0, last_practiced_at integer, PK(user_id, word_id), FK user_id → users(id) ON DELETE CASCADE)` — note `word_id` has no FK so it can hold both seed IDs (`w_001`…) and user IDs (`uw_<UUID>`).
- Local: `pnpm db:generate` ✓ (`drizzle/0049_thankful_dexter_bennett.sql`) → `pnpm db:push` ✓.
- Production Turso: `node scripts/db/apply-2026-05-04-words-rollout.mjs` → `✅ Production rollout verified: words schema is ready.` (tables + FK cascades + composite PKs + unique index all validated).

## Verification
- `pnpm build` — pass; `/words` appears in the route table.
- `pnpm lint` (after clearing `.next-e2e` / `.next-e2e-billing` / `.next` caches) — 0 errors, 13 pre-existing warnings unrelated to this branch.
- `pnpm test:e2e e2e/speak.spec.ts e2e/words.spec.ts` — 7/7 pass (3 speak + 4 words).
- TypeScript (`pnpm exec tsc --noEmit`) clean.
- AI mock path verified end-to-end via `WORDS_E2E_MOCK=1` (e2e Add flow exercises the addWord mutation against the real DB and the dedupe path through the DB unique index).

## Known limitations / follow-ups
- AI enrichment is gated by the user's configured AI provider. Self-hosted users without a provider configured cannot add their own words yet (the modal will surface the underlying AI error). Future work: nicer UX for "no provider set" with a link to settings.
- 100 fixed seeds plus user appends only. No public word-list import (NGSL / Oxford 3000) in v1.
- AI may occasionally drift from the format (e.g. include a part-of-speech tag in `meaningZh` despite the prompt saying not to). v1 stores whatever the AI returns; future work could add a "fix this entry" flow.
- No SRS / no recording / no slow-speed / no remove-word — all explicit non-goals for v1, listed in the spec's Future Work.

## Spec & plan
- Spec: `docs/superpowers/specs/2026-05-04-words-pronunciation-drill-design.md`
- Plan: `docs/superpowers/plans/2026-05-04-words-pronunciation-drill.md`
