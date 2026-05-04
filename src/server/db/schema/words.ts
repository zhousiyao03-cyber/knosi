import { sqliteTable, text, integer, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

/**
 * Words — pronunciation drill module.
 * Spec: docs/superpowers/specs/2026-05-04-words-pronunciation-drill-design.md
 *
 * user_words holds words a user has appended themselves (with AI-enriched
 * 4 fields cached). Seed words live in src/lib/words/seed.ts and are NOT
 * stored here.
 *
 * word_practice holds per-user practice counts for both seed words and
 * user-added words. word_id has no FK so it can hold both ID spaces:
 *   "w_001"…    seed words (from seed.ts)
 *   "uw_<uuid>" user_words.wordId
 */
export const userWords = sqliteTable(
  "user_words",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    wordId: text("word_id").notNull(),
    text: text("text").notNull(),
    textNormalized: text("text_normalized").notNull(),
    ipa: text("ipa").notNull(),
    stressPattern: text("stress_pattern").notNull(),
    meaningZh: text("meaning_zh").notNull(),
    exampleEn: text("example_en").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.wordId] }),
    uniqByText: uniqueIndex("user_words_user_text_idx").on(t.userId, t.textNormalized),
  })
);

export const wordPractice = sqliteTable(
  "word_practice",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    wordId: text("word_id").notNull(),
    count: integer("count").notNull().default(0),
    lastPracticedAt: integer("last_practiced_at").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.wordId] }),
  })
);
