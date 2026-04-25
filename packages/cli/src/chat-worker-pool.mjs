import { ChatWorker } from "./chat-worker.mjs";

/**
 * ChatWorkerPool — manages persistent ChatWorker instances keyed by
 * `(userId, sourceScope, structuredFlag)`. Each key gets at most one live
 * worker. When the worker process exits (idle timeout, crash, or manual
 * kill), it is removed from the pool; the next dispatch for the same key
 * spawns a fresh one (with `--resume` if a session id has been persisted
 * by the caller).
 */
export class ChatWorkerPool {
  constructor(opts = {}) {
    this._workers = new Map();
    this._spawnFn = opts.spawnFn ?? null;
    this._idleTimeoutMs = opts.idleTimeoutMs;
  }

  size() {
    return this._workers.size;
  }

  computeWorkerKey({ userId, sourceScope, structuredFlag }) {
    return `${userId}|${sourceScope}|${structuredFlag ? "tip" : "plain"}`;
  }

  getOrCreate({
    userId,
    sourceScope,
    structuredFlag,
    systemPrompt,
    model,
    cliSessionId,
    onSessionId,
  }) {
    const key = this.computeWorkerKey({
      userId,
      sourceScope,
      structuredFlag,
    });
    const existing = this._workers.get(key);
    if (existing && !existing.isDead()) return existing;
    const worker = new ChatWorker({
      workerKey: key,
      systemPrompt,
      model,
      cliSessionId,
      onSessionId: onSessionId ?? (() => {}),
      onExit: () => {
        this._workers.delete(key);
      },
      ...(this._spawnFn ? { spawnFn: this._spawnFn } : {}),
      ...(this._idleTimeoutMs ? { idleTimeoutMs: this._idleTimeoutMs } : {}),
    });
    this._workers.set(key, worker);
    return worker;
  }

  removeWorker(key) {
    const w = this._workers.get(key);
    if (w) {
      w.kill();
      this._workers.delete(key);
    }
  }

  shutdown() {
    for (const w of this._workers.values()) {
      try {
        w.kill();
      } catch {}
    }
    this._workers.clear();
  }
}
