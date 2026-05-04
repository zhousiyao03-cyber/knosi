import { z } from "zod/v4";

import { generateStructuredData } from "./provider";

export const wordEnrichmentSchema = z.object({
  ipa: z
    .string()
    .min(1)
    .max(80)
    .describe("IPA in slashes, e.g. /ɪˈpɪt.ə.mi/"),
  stressPattern: z
    .string()
    .min(1)
    .max(60)
    .describe(
      "Syllables joined by middle-dots ·, with the stressed syllable in ALL CAPS. Single-syllable words are entirely uppercase. Examples: 'e·PIT·o·me', 'pho·TOG·ra·phy', 'HOUSE'.",
    ),
  meaningZh: z
    .string()
    .min(1)
    .max(40)
    .describe(
      "Most common Chinese meaning, ≤ 12 hanzi total. One sense only — no semicolons, no parens, no part-of-speech labels.",
    ),
  exampleEn: z
    .string()
    .min(1)
    .max(220)
    .describe(
      "One natural-sounding example sentence using the word (or a closely related inflected form). 6-18 words. Working-professional casual register, contractions allowed. No textbook clichés.",
    ),
});

export type WordEnrichment = z.infer<typeof wordEnrichmentSchema>;

const ENRICHMENT_PROMPT = (text: string) => `You are enriching the English word "${text}" for a Chinese learner who already has reading comprehension but wants to practice pronunciation and active recall.

Return a JSON object with these four fields:

1. ipa — the General American IPA transcription wrapped in forward slashes. Example for "epitome": /ɪˈpɪt.ə.mi/

2. stressPattern — syllables separated by middle-dots (·), with the stressed syllable in ALL CAPS. Single-syllable words are fully uppercase. Examples:
   - "epitome" → "e·PIT·o·me"
   - "photography" → "pho·TOG·ra·phy"
   - "house" → "HOUSE"
   - "hierarchy" → "HI·er·ar·chy"

3. meaningZh — the most common Chinese meaning, ≤ 12 Chinese characters total. One sense only. No part-of-speech tags. No semicolons. No parens. Examples:
   - "epitome" → "典型代表" (good — one short sense)
   - "epitome" → "典型；缩影" (bad — has a semicolon)
   - "hierarchy" → "等级制度" (good)

4. exampleEn — one natural-sounding example sentence using "${text}" (or a closely related inflected form). 6-18 words. Working-professional casual register. Contractions OK (gonna, kinda, gotta, that's, etc.). NO textbook clichés like "I want to improve my English." Examples for "epitome":
   - "She's the epitome of a calm-under-pressure engineer." (good)
   - "The epitome is a important word." (bad — broken grammar, dictionary tone)

Be precise. Do not invent senses the word doesn't have. Do not add fields beyond these four.`;

export async function enrichWord(
  text: string,
  ctx: { userId: string },
): Promise<WordEnrichment> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("enrichWord: empty input");

  // E2E + dev short-circuit. Tests rely on this being deterministic.
  if (process.env.WORDS_E2E_MOCK === "1") {
    return {
      ipa: "/test/",
      stressPattern: trimmed.toUpperCase(),
      meaningZh: "测试词",
      exampleEn: `This is a test sentence with ${trimmed}.`,
    };
  }

  return generateStructuredData(
    {
      name: "word_enrichment",
      description:
        "Enrich an English word with IPA, stress pattern, brief Chinese meaning, and one natural example sentence.",
      prompt: ENRICHMENT_PROMPT(trimmed),
      schema: wordEnrichmentSchema,
    },
    { userId: ctx.userId },
  );
}
