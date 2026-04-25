import { spawn as cpSpawn } from "node:child_process";
import { createInterface } from "node:readline";

/**
 * Patterns Claude Code emits when `--resume <id>` references a session the
 * local CLI no longer has. Same regex as wanman's claude-code.ts — the
 * wording shifts across CLI versions ("session" vs "conversation"), so be
 * permissive on the noun. If the pattern drifts further, the error text
 * still flows back through the `result` event with `is_error: true`, which
 * the dispatcher in handler-chat.mjs treats as a generic resume failure.
 */
const RESUME_MISSING_PATTERN =
  /no\s+(?:conversation|session)\s+found|(?:conversation|session)\s+(?:not\s+found|does\s+not\s+exist|unavailable)|could\s+not\s+(?:resume|find\s+(?:conversation|session))/i;

export const DEFAULT_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

let claudeBin = "claude";
export function setChatWorkerClaudeBin(bin) {
  if (bin) claudeBin = bin;
}

/**
 * One ChatWorker = one persistent `claude --input-format stream-json`
 * subprocess tied to a (userId, sourceScope, structuredFlag) workerKey.
 *
 * Tasks are serialized through an internal queue. enqueue() returns a
 * promise that resolves with `{ totalText, sessionId }` after Claude emits
 * the `result` event for that turn. After a successful result the worker
 * stays warm; a 10-minute idle timer kills the process to free resources.
 *
 * The worker calls `onSessionId(id)` whenever Claude reports a system/init
 * event so the caller can persist the id to the server (used as
 * `--resume <id>` on the next spawn after idle expiry).
 */
export class ChatWorker {
  constructor(opts) {
    this.workerKey = opts.workerKey;
    this.systemPrompt = opts.systemPrompt;
    this.model = opts.model;
    this.cliSessionId = opts.cliSessionId ?? null;
    this.onSessionId = opts.onSessionId ?? (() => {});
    this.onExit = opts.onExit ?? (() => {});
    this.idleTimeoutMs = opts.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    this._spawnFn = opts.spawnFn ?? null;
    this._proc = null;
    this._queue = [];
    this._current = null;
    this._currentText = "";
    this._dead = false;
    this._resumeMissed = false;
    this._idleTimer = null;
    this._spawn();
  }

  resumeMissed() {
    return this._resumeMissed;
  }

  isDead() {
    return this._dead;
  }

  _spawn() {
    const args = [
      "--input-format",
      "stream-json",
      "--output-format",
      "stream-json",
      "--include-partial-messages",
      "--verbose",
      "--tools",
      "",
      "--system-prompt",
      this.systemPrompt,
    ];
    if (this.model) args.push("--model", this.model);
    if (this.cliSessionId) args.push("--resume", this.cliSessionId);

    const proc = this._spawnFn
      ? this._spawnFn(claudeBin, args)
      : cpSpawn(claudeBin, args, {
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        });
    this._proc = proc;

    if (proc.stdout) {
      const rl = createInterface({ input: proc.stdout });
      rl.on("line", (line) => this._handleStdoutLine(line));
    }
    proc.stderr?.on("data", () => {});
    proc.on?.("close", (code) => this._handleExit(code));
    proc.on?.("error", (err) => this._failCurrent(err));
  }

  _handleStdoutLine(line) {
    const text = String(line).trim();
    if (!text) return;
    let event;
    try {
      event = JSON.parse(text);
    } catch {
      return;
    }

    if (
      event.type === "system" &&
      event.subtype === "init" &&
      typeof event.session_id === "string"
    ) {
      this.cliSessionId = event.session_id;
      try {
        this.onSessionId(event.session_id);
      } catch {}
      return;
    }

    if (
      event.type === "stream_event" &&
      event.event?.type === "content_block_delta" &&
      event.event.delta?.type === "text_delta" &&
      typeof event.event.delta.text === "string"
    ) {
      const delta = event.event.delta.text;
      this._currentText += delta;
      try {
        this._current?.onText(delta);
      } catch {}
      return;
    }

    if (event.type === "result") {
      const errorText = collectErrorText(event);
      if (
        event.is_error &&
        errorText &&
        this.cliSessionId &&
        RESUME_MISSING_PATTERN.test(errorText)
      ) {
        this._resumeMissed = true;
      }
      const totalText =
        typeof event.result === "string" ? event.result : this._currentText;
      const cur = this._current;
      this._current = null;
      this._currentText = "";
      if (cur) {
        if (event.is_error) {
          cur.reject(new Error(errorText || "claude returned is_error"));
        } else {
          cur.resolve({ totalText, sessionId: this.cliSessionId });
        }
      }
      this._scheduleIdleTimeout();
      this._processQueue();
    }
  }

  _handleExit(code) {
    if (this._dead) return;
    this._dead = true;
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
    if (this._current) {
      this._current.reject(new Error(`claude exited with code ${code}`));
      this._current = null;
    }
    for (const task of this._queue) {
      task.reject(new Error(`claude exited with code ${code}`));
    }
    this._queue.length = 0;
    try {
      this.onExit(code);
    } catch {}
  }

  _failCurrent(err) {
    if (this._current) {
      this._current.reject(err);
      this._current = null;
    }
  }

  _scheduleIdleTimeout() {
    if (this._idleTimer) clearTimeout(this._idleTimer);
    this._idleTimer = setTimeout(() => {
      if (this._queue.length === 0 && !this._current) {
        this.kill();
      }
    }, this.idleTimeoutMs);
  }

  enqueue({ userMessageContent, onText }) {
    if (this._dead) return Promise.reject(new Error("worker dead"));
    return new Promise((resolve, reject) => {
      this._queue.push({ userMessageContent, onText, resolve, reject });
      if (!this._current) this._processQueue();
    });
  }

  _processQueue() {
    if (this._current || this._queue.length === 0 || this._dead) return;
    const task = this._queue.shift();
    this._current = task;
    this._currentText = "";
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
    const line =
      JSON.stringify({
        type: "user",
        message: { role: "user", content: task.userMessageContent },
      }) + "\n";
    try {
      this._proc.stdin.write(line);
    } catch (err) {
      this._failCurrent(err);
      this._handleExit(-1);
    }
  }

  kill() {
    if (this._dead) return;
    try {
      this._proc?.kill();
    } catch {}
  }
}

function collectErrorText(event) {
  const parts = [];
  if (typeof event.result === "string" && event.result.trim()) {
    parts.push(event.result.trim());
  }
  if (typeof event.error === "string" && event.error.trim()) {
    parts.push(event.error.trim());
  }
  if (Array.isArray(event.errors)) {
    for (const err of event.errors) {
      if (typeof err === "string" && err.trim()) parts.push(err.trim());
      else if (
        err &&
        typeof err === "object" &&
        typeof err.message === "string"
      ) {
        parts.push(err.message.trim());
      }
    }
  }
  return parts.join(" | ");
}
