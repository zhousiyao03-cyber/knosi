# Speak — Shadow Drill Phase 1 (2026-05-04)

## Goal
Ship the smallest viable "open and shadow" English speaking module: pick a random native sentence, browser TTS reads it, user shadows it, presses Next. Each sentence's lifetime practice count persists per user.

## Key changes
- New table `speak_sentence_practice` (composite PK `user_id, sentence_id`, FK to `users` ON DELETE CASCADE).
- New tRPC router `speak` with `recordPractice` (UPSERT increment) and `getCounts`. Uses `protectedProcedure`, not `publicProcedure` — the spec mistakenly said the latter; the implementation corrected it because user-scoped writes need `ctx.userId`.
- New `/speak` route under `(app)`, sidebar entry under LEARN with the `Mic` icon.
- 30 hand-picked native seed sentences in `src/lib/speak/seed.ts` (stable IDs `s_001`–`s_030`). Working-professional casual register, 6–18 words, every entry contains at least one expression a Chinese learner is unlikely to actively produce (`ballpark`, `sleep on it`, `a hard sell`, `good shout`, `kind of a stretch`, `on the back burner`, `off the top of my head`, `take it with a grain of salt`, `that tracks`, etc.).
- Browser-native TTS via `speechSynthesis`; voice picker prefers en-US → en-GB → any en-* → platform default; awaits the async `voiceschanged` event with a 300 ms safety timeout.
- Pure shuffle helper (`src/lib/speak/shuffle.ts`) with deterministic-rng test hook (6 vitest cases, all green).
- E2E coverage in `e2e/speak.spec.ts`: sidebar entry, Next changes sentence, practice counter persists across reload (waits for the actual `recordPractice` response rather than a fixed timeout).
- SSR-safe page using `useSyncExternalStore` for the client-only flag and a `shuffleNonce`-driven `useMemo` for the deck order — avoids the hydration mismatch and the `react-hooks/set-state-in-effect` lint trap.

## Files touched
- New: `src/server/db/schema/speak.ts`, `src/server/routers/speak.ts`, `src/lib/speak/{seed,shuffle,shuffle.test,tts}.ts`, `src/app/(app)/speak/page.tsx`, `e2e/speak.spec.ts`, `scripts/db/apply-2026-05-04-speak-rollout.mjs`, `docs/changelog/2026-05-04-speak-phase-1.md`, `docs/superpowers/specs/2026-05-04-speak-shadow-drill-design.md`, `docs/superpowers/plans/2026-05-04-speak-shadow-drill.md`.
- Modified: `src/server/db/schema/index.ts`, `src/server/routers/_app.ts`, `src/components/layout/navigation.ts`, `README.md`.
- Migration: `drizzle/0048_lame_miss_america.sql` + snapshot.

## Database changes
- Table: `speak_sentence_practice (user_id text NOT NULL, sentence_id text NOT NULL, count integer NOT NULL DEFAULT 0, last_practiced_at integer NOT NULL, PRIMARY KEY(user_id, sentence_id), FOREIGN KEY user_id → users(id) ON DELETE CASCADE)`.
- Local: `pnpm db:generate` ✓ → `pnpm db:push` ✓.
- Production Turso: `node scripts/db/apply-2026-05-04-speak-rollout.mjs` → `✅ Production rollout verified: speak schema is ready.` (created table, FK + composite PK validated).

## Verification
- `pnpm vitest run src/lib/speak/shuffle.test.ts` — 6/6 pass.
- `pnpm build` — pass; `/speak` appears in the route table.
- `pnpm lint` (after `rm -rf .next-e2e .next .next-e2e-billing` to clear stale e2e cache the user's auto-memory flagged) — 0 errors, 12 warnings (all pre-existing in other files).
- `pnpm test:e2e e2e/speak.spec.ts` — 3/3 pass, isolated.
- `pnpm test:e2e` (full suite) — speak's three tests pass when run in isolation. The full suite has unrelated pre-existing failures in `v1-core-paths.spec.ts`, `phase6.spec.ts` (search button), and `ask-ai-mention.spec.ts`. Verified those failures reproduce on `main` independent of any change in this branch (they look for `aside` Search buttons / inline @-mention popovers that the runtime no longer renders the same way under parallel workers). Treat as a separate bug to chase later — not introduced by this branch.

## Known limitations / follow-ups
- Browser TTS quality varies by platform; future upgrade path is OpenAI tts-1-hd with R2-cached pre-generation (kept as Future Work in spec).
- iOS Safari blocks the very first auto-play until a user gesture; the page handles this transparently (waits for the first interaction via `useSyncExternalStore`'s client snapshot + the gesture-gated `useEffect` that triggers `speak()`).
- Library is fixed at 30 sentences; "user-submitted sentences", "AI-extended seeds", and "smart prioritization (least-practiced first)" are explicit non-goals for v1.
- Not Pro-gated: this module is free for all users in v1.
- The unrelated e2e failures noted above should be triaged separately. They are flaky / pre-existing on main; do not gate this rollout but should not be ignored long-term.

## Spec & plan
- Spec: `docs/superpowers/specs/2026-05-04-speak-shadow-drill-design.md`
- Plan: `docs/superpowers/plans/2026-05-04-speak-shadow-drill.md`
