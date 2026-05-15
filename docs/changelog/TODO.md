# Knosi — Upcoming Work

Living list of follow-ups that aren't yet scheduled. Move items into a dated
changelog entry when they land.

## Editor

- [ ] Slash command palette: surface recently-used blocks at the top.
- [ ] Drag handle: smarter merge target indicator for image rows.

## AI / RAG

- [ ] Cache embedding requests on the client to avoid re-indexing untouched notes.
- [ ] Per-folder retrieval scoping in Ask AI (limit to the active workspace).

## Curriculum

- [ ] Track-level "what to learn next" suggestions powered by mastery deltas.

## Ops

- [ ] Surface k3s rollout history on `/settings/ops`.
- [ ] Auto-rotate `runtime/ops-snapshot.json` size before it grows past a few MB.

## Eval

- [ ] Add agent-eval baseline run to CI so per-case Δ shows up on every PR that
      touches `src/server/ai/**`.
- [ ] Track top-k retrieval recall@5 over time on the RAG eval dashboard.
- [ ] Tag ground-truth cases by intent (factual / synthesis / navigation) and
      report per-tag scores separately.

## Accessibility

- [ ] Audit editor keyboard navigation: ensure every block can be reached and
      manipulated without a mouse (drag handle, transform menu, slash insert).
- [ ] Add visible focus rings to all custom block hover affordances.
- [ ] Verify Cmd+K search dialog announces result count and active option to
      screen readers.
