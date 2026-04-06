/**
 * Default prompts for source-code analysis tasks.
 *
 * These are baked into the codebase as fallbacks. Per-user overrides live in
 * the `analysis_prompts` table and are managed via the Settings page.
 *
 * Design notes (synthesized from cmer "Ultimate Codebase Analysis" prompt,
 * DeepWiki output structure, and awesome-claude-prompts XML conventions):
 *
 *  - XML tags around sections (Claude responds noticeably better to structured
 *    instructions; works fine for Codex too).
 *  - Explicit "explore → prioritize → read" discipline so the agent does not
 *    blindly cat every file.
 *  - Hard rule: every concrete claim must cite `path/to/file.ext:LINE`.
 *  - "Things you must know before changing code" section — borrowed from cmer.
 *  - Mermaid diagrams for both architecture and core data flow.
 *  - Snapshot header (commit + analysed-at) so the resulting note is
 *    self-dating; the open source repo will keep evolving.
 */

export interface AnalysisPromptContext {
  repoUrl: string;
  /** Full git sha of the cloned working tree. */
  commitSha?: string;
  /** Short sha (first 7 chars) for human display inside the prompt. */
  commitShort?: string;
  /** ISO timestamp of the analysed commit. */
  commitDate?: string;
  /** ISO timestamp of when this analysis run started. */
  analysedAt?: string;
}

export const DEFAULT_ANALYSIS_PROMPT = `<role>
You are a senior software architect performing a deep, systematic source-code reading of the open source project in the current working directory. You will explore the repository directly using the file tools available to you (Read, Grep, Glob, Bash). The full source is NOT pasted into this prompt — you must navigate it yourself.
</role>

<repo>
URL: {{REPO_URL}}
Commit: {{COMMIT_SHORT}} ({{COMMIT_SHA}})
Commit date: {{COMMIT_DATE}}
Analysed at: {{ANALYSED_AT}}
</repo>

<reading_strategy>
Work in four progressive layers. Do NOT skip layers — each builds on the previous. At the end of every layer, write a one-paragraph "Layer N takeaway" capturing the single most important thing you learned. These takeaways act as your working memory: if your context fills up later, the takeaways are what you carry forward.

### Layer 1 — Project portrait (cheap, must do first)
1. Read README, CONTRIBUTING, ARCHITECTURE / DESIGN docs if present.
2. Read the dependency manifest (package.json / Cargo.toml / pyproject.toml / go.mod / pom.xml ...). Identify the core dependencies and what they imply about the tech choices.
3. List the top 2–3 levels of the directory tree. For each top-level dir, write one sentence on its responsibility.
4. Answer: what problem does this solve? Who is the target user? Where is the entry point?

**End-of-layer takeaway:** one paragraph summarizing what this project IS.

### Layer 2 — Architecture & data flow
1. Find the program entry point(s) and trace the startup sequence.
2. Identify the core abstractions (key interface / trait / class / type / Protocol). Sketch how they relate.
3. Pick ONE typical user-facing operation and trace its complete data flow end-to-end. Cite every file you walk through.
4. Identify the layering: which modules are public API, which are internal, where are the boundaries?
5. Answer: what is the single most important architectural decision in this project?

**End-of-layer takeaway:** one paragraph naming the single most important architectural decision and why it matters.

### Layer 3 — Core module deep dive
Pick the 2–3 most important modules. For each:
1. Read every meaningful file inside.
2. Call out the clever bits: design patterns, performance optimizations, error-handling strategies, concurrency control, defensive programming.
3. Analyse trade-offs: why this approach instead of the more obvious one?
4. Note edge-case handling that surprised you.

**End-of-layer takeaway:** one paragraph per module — what's the one thing a future contributor must understand about it.

### Layer 4 — Tests & engineering
1. Test strategy: what is the unit / integration / e2e mix?
2. CI / CD setup, release process.
3. Code quality tooling (linters, formatters, type checkers).

**End-of-layer takeaway:** one paragraph on engineering maturity and what it tells you about the project's stage.
</reading_strategy>

<evidence_rules>
These rules are non-negotiable. Output that violates them is wrong, no matter how plausible it sounds.

1. **TRACE ACTUAL CODE PATHS.** Do not guess from file names, directory names, or imports alone. Open the file. Read the function. Confirm the behavior.
2. **EVERY CONCRETE CLAIM NEEDS A SOURCE.** Format: \`path/to/file.ext:LINE\` (or \`:START-END\` for ranges). The citation must point to code that *directly* proves the claim — not a nearby file, not "see the X module".
3. **DISTINGUISH VERIFIED FROM INFERRED.** If you read the code and confirmed something, state it as fact. If you're inferring from naming, types, or context, say "appears to" or "likely" and explain the inference.
4. **WHY BEFORE WHAT.** Don't describe what the code does line by line. Explain *why* it's structured that way. The reader can read the code themselves — they need the reasoning that isn't in the source.
5. **NO SPECULATIVE LANGUAGE WITHOUT EVIDENCE.** Banned phrases unless backed by a citation: "well-designed", "uses best practices", "industry standard", "elegant", "clean architecture". Show the specific lines that prove the claim, or cut the claim.
</evidence_rules>

<rules>
1. **Honest about gaps.** If you didn't read something or didn't understand it, say so in the "Open Questions" section. Do NOT fabricate.
2. **Explore before reading.** Use Glob/Grep to map the territory before opening files. Prioritize high-signal targets: entry points, core abstractions, the files other files import most.
3. **Snapshot discipline.** This analysis is anchored to commit \`{{COMMIT_SHORT}}\`. The project will change after this. Note anywhere the code looked in-flux (TODOs, deprecated paths, half-finished refactors).
</rules>

<output_format>
Output ONE Markdown document with this exact structure. The first line MUST be the H1 title.

# [Project name] — Source Reading Notes

> **Source:** [{{REPO_URL}}]({{REPO_URL}})
> **Snapshot:** commit [\`{{COMMIT_SHORT}}\`]({{REPO_URL}}/commit/{{COMMIT_SHA}}) · committed {{COMMIT_DATE}} · analysed {{ANALYSED_AT}}
> **One-liner:** [a single sentence capturing the essence of this project]

## Project Portrait
- **Problem solved:**
- **Target user:**
- **Tech stack:** (language, framework, key deps)
- **Repo size:** ~X files / ~X lines (run \`find\` or use a heuristic)
- **Entry point(s):**

## Architecture Overview
A short prose summary, followed by:

### Directory map
\`\`\`
[2–3 level tree with one-line annotations per directory]
\`\`\`

### Module relationships
\`\`\`mermaid
[graph TD or flowchart showing the core modules and their dependencies]
\`\`\`

> **Diagram requirement:** this note must contain at least 2 Mermaid diagrams of *different types*. The Module relationships diagram above (a graph/flowchart) is one. The Core Data Flow section below must use a different type — \`sequenceDiagram\` is preferred for tracing an operation, but \`stateDiagram-v2\` is also acceptable when the operation is state-driven. A single flowchart is not enough.

## Core Data Flow
Pick one canonical user operation. Walk through it step by step, citing each file you touch. End with a Mermaid sequence or flow diagram.

\`\`\`mermaid
[sequenceDiagram or flowchart showing the traced operation]
\`\`\`

## Hard Parts & Bright Spots
List 3–5 of each. Format:

### Hard part 1: [title]
- **The problem:**
- **How they solved it:**
- **Key code:** \`path/to/file.ext:LINE\`

### Bright spot 1: [title]
- **What's clever:**
- **vs. the obvious approach:**
- **Key code:** \`path/to/file.ext:LINE\`

## Design Decisions
| Decision | Choice made | Alternative | Why this one |
|---|---|---|---|

## Things You Must Know Before Changing Code
Non-obvious gotchas a new contributor would step on. Each item must cite the code that proves it.

- ...
- ...

## Patterns Worth Stealing
Concrete, transferable patterns with short code snippets and \`file:line\` citations. These are the "I want to use this in my own project" findings.

## Layer Takeaways
The four end-of-layer takeaways from your reading process, in order. This section is the TL;DR — someone reading only this should understand what the project is, its key architectural decision, what each core module is for, and the engineering maturity.

1. **What it is:** [Layer 1 takeaway]
2. **Key architectural decision:** [Layer 2 takeaway]
3. **Core modules:** [Layer 3 takeaways, one per module]
4. **Engineering maturity:** [Layer 4 takeaway]

## Open Questions
Things you didn't fully understand or didn't have time to read. Be specific — "I didn't read the X module" is fine, "this codebase is complex" is not.
</output_format>`;

export const DEFAULT_FOLLOWUP_PROMPT = `<role>
You previously generated a source-reading note for this repository. The user is now asking a follow-up question. Answer it by reading the actual source code in the current working directory — do not rely solely on the prior note, and do not fabricate.
</role>

<repo>
URL: {{REPO_URL}}
Commit: {{COMMIT_SHORT}} ({{COMMIT_SHA}})
Commit date: {{COMMIT_DATE}}
Asked at: {{ANALYSED_AT}}
</repo>

<previous_analysis>
{{ORIGINAL_ANALYSIS}}
</previous_analysis>

<question>
{{QUESTION}}
</question>

<rules>
1. Read the relevant source files before answering. Cite \`path/to/file.ext:LINE\` for every concrete claim.
2. If the previous analysis is wrong or stale relative to the current commit, say so explicitly and correct it.
3. Be concise. The user already has the long-form analysis.
4. Output Markdown. Start with a 1–2 sentence direct answer, then provide the supporting evidence below.
</rules>`;

/**
 * Substitute {{TOKEN}} placeholders in a prompt template with concrete values
 * from the analysis context.
 *
 * Behavior for missing values:
 *   - If the field is `undefined` in `ctx`, the placeholder is left untouched
 *     (so a later pass can fill it in). This lets the server pre-render
 *     `REPO_URL` while leaving commit fields for the daemon to fill after
 *     `git clone`.
 *   - If the field is an empty string, it is replaced with "unknown".
 *   - To force-replace all remaining placeholders (final pass), pass
 *     `{ fillMissingWith: "unknown" }`.
 */
export function renderPrompt(
  template: string,
  ctx: Partial<AnalysisPromptContext> & { question?: string; originalAnalysis?: string },
  options: { fillMissingWith?: string } = {}
): string {
  const map: Record<string, string | undefined> = {
    REPO_URL: ctx.repoUrl,
    COMMIT_SHA: ctx.commitSha,
    COMMIT_SHORT:
      ctx.commitShort ?? (ctx.commitSha ? ctx.commitSha.slice(0, 7) : undefined),
    COMMIT_DATE: ctx.commitDate,
    ANALYSED_AT: ctx.analysedAt,
    QUESTION: ctx.question,
    ORIGINAL_ANALYSIS: ctx.originalAnalysis,
  };

  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const value = map[key];
    if (value !== undefined) {
      // Empty string means "I tried to fill this but had no data" → "unknown"
      return value === "" ? "unknown" : value;
    }
    // Field was not provided at all → keep placeholder for a later pass
    // (unless caller explicitly asked to fill all missing fields)
    return options.fillMissingWith ?? match;
  });
}
