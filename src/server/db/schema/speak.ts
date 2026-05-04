import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { users } from "./auth";

/**
 * Speak — shadow drill practice counts.
 * Spec: docs/superpowers/specs/2026-05-04-speak-shadow-drill-design.md
 *
 * One row per (user, sentence). `sentence_id` is the stable string ID from
 * src/lib/speak/seed.ts (e.g. "s_001"); never a DB-generated PK. Editing the
 * sentence text in seed.ts does not break historical counts.
 */
export const speakSentencePractice = sqliteTable(
  "speak_sentence_practice",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sentenceId: text("sentence_id").notNull(),
    count: integer("count").notNull().default(0),
    lastPracticedAt: integer("last_practiced_at").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.sentenceId] }),
  })
);
