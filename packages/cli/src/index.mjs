#!/usr/bin/env node
/**
 * @knosi/cli — Local Claude Code daemon for Second Brain
 *
 * Usage:
 *   npx @knosi/cli --url https://your-instance.vercel.app
 *   npx @knosi/cli --once
 *   npx @knosi/cli login     # authenticate with your account
 *   npx @knosi/cli logout    # remove saved token
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { configure, claimTask, sendHeartbeat, setAuthToken } from "./api.mjs";
import { setClaudeBin } from "./spawn-claude.mjs";
import { handleChatTask } from "./handler-chat.mjs";
import { handleStructuredTask } from "./handler-structured.mjs";

// ── Parse args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const command = args[0];

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

const serverUrl = getArg("--url") || "https://www.knosi.xyz";
const isOnce = args.includes("--once");
const claudeBinArg = getArg("--claude-bin") || "claude";

const CHAT_POLL_MS = 2_000;
const STRUCTURED_POLL_MS = 1_000;
const HEARTBEAT_MS = 120_000;
const MAX_CONCURRENT_CHAT = 3;
const MAX_CONCURRENT_STRUCTURED = 5;

// ── Token storage ───────────────────────────────────────────────────────
const CONFIG_DIR = join(homedir(), ".knosi");
const TOKEN_FILE = join(CONFIG_DIR, "token");

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadToken() {
  try {
    return readFileSync(TOKEN_FILE, "utf8").trim();
  } catch {
    return null;
  }
}

function saveToken(token) {
  ensureConfigDir();
  writeFileSync(TOKEN_FILE, token, { mode: 0o600 });
}

function removeToken() {
  try {
    unlinkSync(TOKEN_FILE);
  } catch {
    // ignore
  }
}

// ── Login flow ──────────────────────────────────────────────────────────
async function loginFlow() {
  console.log("");
  console.log("🔐 Knosi CLI Login");
  console.log("");
  console.log("To authenticate, generate a CLI token from your Knosi account:");
  console.log("");
  console.log(`  1. Open ${serverUrl}/settings in your browser`);
  console.log("  2. Click \"Generate CLI Token\"");
  console.log("  3. Copy the token and paste it below");
  console.log("");

  const readline = await import("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const token = await new Promise((resolve) => {
    rl.question("Token: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  if (!token) {
    console.error("❌ No token provided.");
    process.exit(1);
  }

  // Verify the token works
  configure(serverUrl);
  setAuthToken(token);
  try {
    await claimTask("chat"); // will return null (no tasks) or throw AUTH_FAILED
    saveToken(token);
    console.log("");
    console.log("✅ Authenticated successfully! Token saved to ~/.knosi/token");
    console.log("   Run `knosi` to start the daemon.");
  } catch (err) {
    if (err.message === "AUTH_FAILED") {
      console.error("❌ Invalid token. Please check and try again.");
      process.exit(1);
    }
    // Network error — token might be valid but server is down
    saveToken(token);
    console.log("");
    console.log("⚠️  Could not verify token (server may be down), but saved it.");
    console.log("   Run `knosi` to start the daemon.");
  }
}

// ── Commands ────────────────────────────────────────────────────────────
if (command === "login") {
  await loginFlow();
  process.exit(0);
}

if (command === "logout") {
  removeToken();
  console.log("✅ Token removed. Run `knosi login` to re-authenticate.");
  process.exit(0);
}

// ── Preflight ───────────────────────────────────────────────────────────
function checkClaude() {
  try {
    const version = execSync(`${claudeBinArg} --version`, { encoding: "utf8" }).trim();
    console.log(`✓ Claude CLI: ${version}`);
    return true;
  } catch {
    console.error(`✗ Claude CLI not found at "${claudeBinArg}"`);
    console.error("  Install: npm install -g @anthropic-ai/claude-code");
    console.error("  Or specify: --claude-bin /path/to/claude");
    return false;
  }
}

// Load token
const token = loadToken();
if (!token) {
  console.error("❌ Not authenticated. Run `knosi login` first.");
  process.exit(1);
}

// ── Main ────────────────────────────────────────────────────────────────
configure(serverUrl);
setClaudeBin(claudeBinArg);
setAuthToken(token);

if (!checkClaude()) process.exit(1);

function ts() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

let chatRunning = 0;
let structuredRunning = 0;

async function pollChat() {
  if (chatRunning >= MAX_CONCURRENT_CHAT) return;
  try {
    const task = await claimTask("chat");
    if (!task) return;
    chatRunning++;
    handleChatTask(task)
      .catch(() => {})
      .finally(() => { chatRunning--; });
  } catch (err) {
    if (err.message === "AUTH_FAILED") {
      console.error("❌ Token rejected by server. Run `knosi login` to re-authenticate.");
      process.exit(1);
    }
  }
}

async function pollStructured() {
  if (structuredRunning >= MAX_CONCURRENT_STRUCTURED) return;
  try {
    const task = await claimTask("structured");
    if (!task) return;
    structuredRunning++;
    handleStructuredTask(task)
      .catch(() => {})
      .finally(() => { structuredRunning--; });
  } catch (err) {
    if (err.message === "AUTH_FAILED") {
      console.error("❌ Token rejected by server. Run `knosi login` to re-authenticate.");
      process.exit(1);
    }
  }
}

if (isOnce) {
  console.log("🔍 Single-run mode...");
  await pollChat();
  await pollStructured();
  console.log("Done.");
} else {
  console.log("");
  console.log("🚀 Knosi AI Daemon");
  console.log(`   Server: ${serverUrl}`);
  console.log(`   Chat poll: ${CHAT_POLL_MS / 1000}s | Structured poll: ${STRUCTURED_POLL_MS / 1000}s`);
  console.log(`   Max concurrent: chat=${MAX_CONCURRENT_CHAT} structured=${MAX_CONCURRENT_STRUCTURED}`);
  console.log("");
  console.log("   Waiting for tasks... (Ctrl+C to stop)");
  console.log("");

  // Heartbeat
  await sendHeartbeat("daemon");
  setInterval(() => sendHeartbeat("daemon"), HEARTBEAT_MS);

  // Poll loops
  setInterval(pollChat, CHAT_POLL_MS);
  setInterval(pollStructured, STRUCTURED_POLL_MS);

  // Graceful shutdown
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
      console.log(`\n[${ts()}] daemon stopped`);
      process.exit(0);
    });
  }
}
