import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("D:/repos/knosi/.env.turso-prod.local", "utf8")
    .split("\n").filter(Boolean).map((l) => {
      const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1)];
    })
);

const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

const userId = "5dcad5a2-1d20-43df-818c-d640958ddb8a";

// Mirror the logic from src/lib/note-templates.ts so we can check without importing TS.
const JOURNAL_TITLE_DATE_PATTERN = /^(\d{4})年(\d{1,2})月(\d{1,2})日(?:\s+(星期[日一二三四五六]|周[日一二三四五六天]))?$/;

function parseDate(title) {
  const m = title.trim().match(JOURNAL_TITLE_DATE_PATTERN);
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Number(y), Number(mo) - 1, Number(d), 12, 0, 0, 0);
}

function formatCanonical(date) {
  const datePart = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "long", day: "numeric",
  }).format(date);
  const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(date);
  return `${datePart} ${weekday}`;
}

function normalize(title) {
  const date = parseDate(title);
  if (!date) return null;
  return formatCanonical(date);
}

const r = await client.execute({
  sql: `SELECT id, title FROM notes WHERE user_id = ? AND type = 'journal' ORDER BY title`,
  args: [userId],
});

let needsUpdate = 0;
let nonAutoTitle = 0;
let alreadyNormalized = 0;

console.log(`Checking ${r.rows.length} journal notes:\n`);
for (const row of r.rows) {
  const norm = normalize(row.title);
  if (norm === null) {
    nonAutoTitle++;
    console.log(`  CUSTOM    "${row.title}"`);
  } else if (norm === row.title) {
    alreadyNormalized++;
  } else {
    needsUpdate++;
    console.log(`  NEEDS-FIX "${row.title}"  →  "${norm}"`);
  }
}

console.log(`\nSummary:`);
console.log(`  Already normalized: ${alreadyNormalized}`);
console.log(`  Custom title (skipped by migration): ${nonAutoTitle}`);
console.log(`  Still needs fix: ${needsUpdate}`);
