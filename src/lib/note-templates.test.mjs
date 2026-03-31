import test from "node:test";
import assert from "node:assert/strict";

import {
  formatJournalTitle,
  normalizeAutoJournalTitle,
  parseAutoJournalTitleDate,
} from "./note-templates.ts";

test("formatJournalTitle includes weekday", () => {
  assert.equal(
    formatJournalTitle(new Date("2026-03-31T12:00:00.000Z")),
    "2026年3月31日 星期二"
  );
});

test("parseAutoJournalTitleDate accepts legacy and weekday journal titles", () => {
  assert.equal(
    parseAutoJournalTitleDate("2026年3月31日")?.toISOString(),
    "2026-03-31T04:00:00.000Z"
  );
  assert.equal(
    parseAutoJournalTitleDate("2026年3月31日 星期二")?.toISOString(),
    "2026-03-31T04:00:00.000Z"
  );
});

test("normalizeAutoJournalTitle upgrades legacy journal titles and skips custom ones", () => {
  assert.equal(
    normalizeAutoJournalTitle("2026年3月31日"),
    "2026年3月31日 星期二"
  );
  assert.equal(
    normalizeAutoJournalTitle("2026年3月31日 星期二"),
    "2026年3月31日 星期二"
  );
  assert.equal(normalizeAutoJournalTitle("Project kickoff"), null);
});
