#!/usr/bin/env node

/**
 * Usage Daemon — 扫描本机 Claude Code / Codex 日志，自动同步到线上 Second Brain
 *
 * 用法：
 *   pnpm usage:daemon                          # 后台常驻，每 5 分钟同步
 *   pnpm usage:report                          # 单次同步
 *
 * 环境变量：
 *   SECOND_BRAIN_URL    — 线上地址（默认 http://localhost:3200）
 *   USAGE_REPORT_SECRET — 上报密钥（需要和服务端 .env 中的一致）
 *
 * 首次使用：
 *   1. 在线上部署的环境变量中设置 USAGE_REPORT_SECRET
 *   2. 在本机创建 ~/.second-brain-usage.env：
 *        SECOND_BRAIN_URL=https://你的域名
 *        USAGE_REPORT_SECRET=你设置的密钥
 *   3. 运行 pnpm usage:daemon
 */

import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ---------------------------------------------------------------------------
// Config: load from ~/.second-brain-usage.env if exists
// ---------------------------------------------------------------------------

const envFile = join(homedir(), ".second-brain-usage.env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

const SERVER_URL = process.env.SECOND_BRAIN_URL || "http://localhost:3200";
const SECRET = process.env.USAGE_REPORT_SECRET;
const SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const IS_DAEMON = process.argv.includes("--daemon");

if (!SECRET) {
  console.error("❌ 缺少 USAGE_REPORT_SECRET");
  console.error("");
  console.error("请创建 ~/.second-brain-usage.env 文件：");
  console.error("  SECOND_BRAIN_URL=https://你的域名");
  console.error("  USAGE_REPORT_SECRET=你设置的密钥");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeToken(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function toDateKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timestamp() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

// ---------------------------------------------------------------------------
// Scan & Aggregate (creates a fresh map each time)
// ---------------------------------------------------------------------------

function scan() {
  const aggMap = new Map();

  function merge(date, provider, model, input, output, cacheRead, cacheWrite) {
    const key = `${date}|${provider}|${model}`;
    const existing = aggMap.get(key);
    if (existing) {
      existing.input_tokens += input;
      existing.output_tokens += output;
      existing.cache_read_tokens += cacheRead;
      existing.cache_write_tokens += cacheWrite;
    } else {
      aggMap.set(key, {
        date, provider, model,
        input_tokens: input,
        output_tokens: output,
        cache_read_tokens: cacheRead,
        cache_write_tokens: cacheWrite,
      });
    }
  }

  // --- Claude Code ---
  const claudeRoot = join(homedir(), ".claude", "projects");
  if (existsSync(claudeRoot)) {
    const files = listJsonlFiles(claudeRoot);
    for (const filePath of files) {
      try {
        const raw = readFileSync(filePath, "utf8");
        const fallbackTs = statSync(filePath).mtimeMs;
        for (const line of raw.split(/\r?\n/)) {
          if (!line.trim()) continue;
          try {
            const item = JSON.parse(line);
            const usage = item.message?.usage;
            if (!usage) continue;
            const input = normalizeToken(usage.input_tokens);
            const output = normalizeToken(usage.output_tokens);
            const cacheRead = normalizeToken(usage.cache_read_input_tokens);
            const cacheWrite = normalizeToken(usage.cache_creation_input_tokens);
            if (input + output + cacheRead + cacheWrite === 0) continue;
            const ts = item.timestamp ? Date.parse(item.timestamp) : fallbackTs;
            const date = toDateKey(Number.isFinite(ts) ? ts : fallbackTs);
            let model = item.message?.model ?? "unknown";
            if (model.startsWith("anthropic.")) model = model.slice(10);
            merge(date, "claude-code", model, input, output, cacheRead, cacheWrite);
          } catch { continue; }
        }
      } catch { continue; }
    }
  }

  // --- Codex (sync, skip if no better-sqlite3) ---
  try {
    const codexDir = join(homedir(), ".codex");
    if (existsSync(codexDir)) {
      // Dynamic require for optional dependency
      const runtimeRequire = new Function("specifier", "return require(specifier)");
      const Database = runtimeRequire("better-sqlite3");
      const dbFiles = readdirSync(codexDir)
        .filter((name) => /^state(?:_\d+)?\.sqlite$/.test(name))
        .map((name) => join(codexDir, name))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

      if (dbFiles.length > 0) {
        const sqlite = new Database(dbFiles[0], { readonly: true, fileMustExist: true });
        const rows = sqlite
          .prepare("SELECT model, tokens_used, updated_at FROM threads WHERE tokens_used > 0")
          .all();
        sqlite.close();
        for (const row of rows) {
          const date = toDateKey(normalizeToken(row.updated_at) * 1000);
          merge(date, "codex", row.model ?? "unknown", 0, normalizeToken(row.tokens_used), 0, 0);
        }
      }
    }
  } catch { /* Codex not available, skip silently */ }

  return [...aggMap.values()];
}

function listJsonlFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...listJsonlFiles(p));
    else if (entry.name.endsWith(".jsonl")) results.push(p);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Upload to server
// ---------------------------------------------------------------------------

async function upload(entries) {
  const BATCH_SIZE = 200;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    const res = await fetch(`${SERVER_URL}/api/usage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SECRET}`,
      },
      body: JSON.stringify({ entries: batch }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Single report cycle
// ---------------------------------------------------------------------------

async function reportOnce() {
  const entries = scan();
  if (entries.length === 0) {
    console.log(`[${timestamp()}] 没有 usage 数据`);
    return;
  }

  await upload(entries);
  console.log(`[${timestamp()}] ✅ 同步 ${entries.length} 条记录 → ${SERVER_URL}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (IS_DAEMON) {
  // Write PID file for management
  const pidFile = join(homedir(), ".second-brain-usage.pid");
  writeFileSync(pidFile, String(process.pid));

  console.log(`🚀 Usage daemon 已启动 (PID: ${process.pid})`);
  console.log(`   服务器: ${SERVER_URL}`);
  console.log(`   同步间隔: ${SCAN_INTERVAL_MS / 1000}s`);
  console.log(`   PID 文件: ${pidFile}`);
  console.log("");

  // Initial sync
  await reportOnce().catch((err) => console.error(`[${timestamp()}] ❌`, err.message));

  // Recurring sync
  setInterval(async () => {
    await reportOnce().catch((err) => console.error(`[${timestamp()}] ❌`, err.message));
  }, SCAN_INTERVAL_MS);

  // Graceful shutdown
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
      console.log(`\n[${timestamp()}] 收到 ${sig}，daemon 退出`);
      try { import("fs").then(fs => fs.unlinkSync(pidFile)); } catch {}
      process.exit(0);
    });
  }
} else {
  // Single run mode
  console.log("🔍 扫描本机 usage 数据...");
  await reportOnce();
}
