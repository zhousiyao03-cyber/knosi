#!/usr/bin/env node

/**
 * One-off: enrich a hand-picked /words seed list via the project's AI
 * pipeline and write the result to stdout. Run from the repo root with
 * the same .env that powers `pnpm dev`:
 *
 *   pnpm tsx scripts/words/generate-seed-enrichment.mjs > /tmp/words.json
 *
 * The script writes JSON to stdout; pipe it into seed.ts after a human
 * review pass. Do NOT trust the AI output verbatim — read each entry and
 * fix anything that smells like textbook English.
 *
 * Note: src/lib/words/seed.ts is the source of truth and was first authored
 * directly by hand (with model-as-author working through each entry). This
 * script exists for future regeneration / extension.
 */

import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const HAND_PICKED = [
  // stress traps
  "epitome", "hierarchy", "photography", "comparable", "applicable",
  "preferable", "admirable", "vehement", "exquisite", "irreparable",
  "comparable", "lamentable", "formidable", "inexplicable",

  // silent letters / tricky vowels
  "colonel", "subtle", "almond", "debris", "rendezvous",
  "buffet", "depot", "suite", "queue", "hyperbole",

  // commonly mispronounced loans
  "niche", "facade", "rapport", "genre", "cliche",
  "denouement", "ennui", "concierge", "lingerie", "entrepreneur",

  // working-professional uplift
  "ballpark", "bandwidth", "leverage", "synergy",
  "stakeholder", "deliverable", "milestone", "cadence", "alignment",
  "snag", "blocker", "context", "nuance",

  // hedge / discourse markers
  "honestly", "literally", "essentially", "particularly", "precisely",
  "presumably", "ostensibly", "inevitably", "arguably",

  // approval / disagreement
  "absolutely", "definitely", "exactly",
  "scarcely", "hardly", "barely", "surely", "rarely",

  // emotion / attitude
  "frustrating", "exhausting", "rewarding", "fulfilling", "compelling",
  "underwhelming", "overwhelming", "lukewarm", "tepid", "fervent",

  // verbs of working life
  "iterate", "validate", "deprecate", "delegate", "escalate",
  "circumvent", "navigate", "consolidate", "expedite", "prioritize",

  // misc actively-useful
  "verbatim", "caveat",
  "anecdote", "anomaly", "paradigm", "precedent", "rationale",
];

async function main() {
  const { enrichWord } = await import("../../src/server/ai/words.ts");
  const out = [];
  const seen = new Set();
  for (let i = 0; i < HAND_PICKED.length; i++) {
    const word = HAND_PICKED[i];
    if (seen.has(word.toLowerCase())) {
      process.stderr.write(`[skip dup] ${word}\n`);
      continue;
    }
    seen.add(word.toLowerCase());
    process.stderr.write(`[${out.length + 1}] ${word}... `);
    try {
      const enriched = await enrichWord(word, { userId: "seed-script" });
      out.push({
        id: `w_${String(out.length + 1).padStart(3, "0")}`,
        text: word,
        ...enriched,
      });
      process.stderr.write("ok\n");
    } catch (err) {
      process.stderr.write(`FAIL: ${err.message}\n`);
    }
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
