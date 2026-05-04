#!/usr/bin/env node

/**
 * Production Turso rollout — words (pronunciation drill).
 *
 * Creates two new tables:
 *   user_words      — composite PK (user_id, word_id), unique idx on
 *                     (user_id, text_normalized), FK user_id → users
 *   word_practice   — composite PK (user_id, word_id), FK user_id → users
 *
 * Source: drizzle/0049_thankful_dexter_bennett.sql.
 * Idempotent.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, "..", "..");

function loadEnv(path) {
  const content = readFileSync(path, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(join(repoRoot, ".env.turso-prod.local"));

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
  console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  process.exit(1);
}

const client = createClient({ url, authToken });

console.log("Production Turso rollout — words (pronunciation drill)");
console.log(`Target: ${url}`);
console.log("");

async function tableExists(name) {
  const r = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [name],
  });
  return r.rows.length > 0;
}
async function indexExists(name) {
  const r = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?",
    args: [name],
  });
  return r.rows.length > 0;
}

if (!(await tableExists("user_words"))) {
  console.log("Creating user_words...");
  await client.execute(`
    CREATE TABLE user_words (
      user_id text NOT NULL,
      word_id text NOT NULL,
      text text NOT NULL,
      text_normalized text NOT NULL,
      ipa text NOT NULL,
      stress_pattern text NOT NULL,
      meaning_zh text NOT NULL,
      example_en text NOT NULL,
      created_at integer NOT NULL,
      PRIMARY KEY (user_id, word_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
    )
  `);
} else {
  console.log("Skip — user_words already exists.");
}

if (!(await indexExists("user_words_user_text_idx"))) {
  await client.execute(
    "CREATE UNIQUE INDEX user_words_user_text_idx ON user_words (user_id, text_normalized)",
  );
}

if (!(await tableExists("word_practice"))) {
  console.log("Creating word_practice...");
  await client.execute(`
    CREATE TABLE word_practice (
      user_id text NOT NULL,
      word_id text NOT NULL,
      count integer NOT NULL DEFAULT 0,
      last_practiced_at integer NOT NULL,
      PRIMARY KEY (user_id, word_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
    )
  `);
} else {
  console.log("Skip — word_practice already exists.");
}

console.log("");
console.log("Verification:");

for (const t of ["user_words", "word_practice"]) {
  if (!(await tableExists(t))) {
    console.error(`  FAIL — missing table ${t}`);
    process.exit(1);
  }
  console.log(`  OK — table ${t} exists`);

  const fkResult = await client.execute({
    sql: `PRAGMA foreign_key_list('${t}')`,
  });
  const usersFk = fkResult.rows.find((r) => r.table === "users");
  if (!usersFk || usersFk.on_delete !== "CASCADE") {
    console.error(`  FAIL — ${t} missing FK to users(id) ON DELETE CASCADE`);
    process.exit(1);
  }
  console.log(`  OK — ${t}.user_id → users(id) ON DELETE CASCADE`);

  const pkResult = await client.execute({
    sql: `PRAGMA table_info('${t}')`,
  });
  const pkCols = pkResult.rows
    .filter((r) => r.pk > 0)
    .sort((a, b) => Number(a.pk) - Number(b.pk))
    .map((r) => r.name);
  if (pkCols.join(",") !== "user_id,word_id") {
    console.error(
      `  FAIL — ${t} composite PK columns are ${pkCols.join(",") || "(none)"}, expected user_id,word_id`,
    );
    process.exit(1);
  }
  console.log(`  OK — ${t} composite PK (user_id, word_id)`);
}

if (!(await indexExists("user_words_user_text_idx"))) {
  console.error("  FAIL — missing unique index user_words_user_text_idx");
  process.exit(1);
}
console.log("  OK — unique index user_words_user_text_idx exists");

console.log("");
console.log("✅ Production rollout verified: words schema is ready.");
