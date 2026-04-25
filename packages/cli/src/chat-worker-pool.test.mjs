import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Readable, Writable } from "node:stream";
import { ChatWorkerPool } from "./chat-worker-pool.mjs";

function makeMockChild() {
  const stdout = new Readable({ read() {} });
  const stderr = new Readable({ read() {} });
  const stdin = new Writable({
    write(_c, _e, cb) {
      cb();
    },
  });
  const child = new EventEmitter();
  child.stdout = stdout;
  child.stderr = stderr;
  child.stdin = stdin;
  child.kill = () => child.emit("close", 0);
  return { child, stdout };
}

test("computeWorkerKey returns stable key for same inputs", () => {
  const pool = new ChatWorkerPool({ spawnFn: () => makeMockChild().child });
  assert.equal(
    pool.computeWorkerKey({
      userId: "u1",
      sourceScope: "all",
      structuredFlag: false,
    }),
    "u1|all|plain"
  );
  assert.equal(
    pool.computeWorkerKey({
      userId: "u2",
      sourceScope: "notes",
      structuredFlag: true,
    }),
    "u2|notes|tip"
  );
  pool.shutdown();
});

test("getOrCreate reuses worker for same key", () => {
  const pool = new ChatWorkerPool({
    spawnFn: () => makeMockChild().child,
  });
  const a = pool.getOrCreate({
    userId: "u1",
    sourceScope: "all",
    structuredFlag: false,
    systemPrompt: "S",
    model: "opus",
    cliSessionId: null,
  });
  const b = pool.getOrCreate({
    userId: "u1",
    sourceScope: "all",
    structuredFlag: false,
    systemPrompt: "S",
    model: "opus",
    cliSessionId: null,
  });
  assert.equal(a, b);
  pool.shutdown();
});

test("different sourceScope produces different worker", () => {
  const pool = new ChatWorkerPool({
    spawnFn: () => makeMockChild().child,
  });
  const a = pool.getOrCreate({
    userId: "u1",
    sourceScope: "all",
    structuredFlag: false,
    systemPrompt: "S",
    model: "opus",
    cliSessionId: null,
  });
  const b = pool.getOrCreate({
    userId: "u1",
    sourceScope: "notes",
    structuredFlag: false,
    systemPrompt: "S",
    model: "opus",
    cliSessionId: null,
  });
  assert.notEqual(a, b);
  pool.shutdown();
});

test("worker exit removes it from pool", async () => {
  const mock = makeMockChild();
  const pool = new ChatWorkerPool({ spawnFn: () => mock.child });
  pool.getOrCreate({
    userId: "u1",
    sourceScope: "all",
    structuredFlag: false,
    systemPrompt: "S",
    model: "opus",
    cliSessionId: null,
  });
  assert.equal(pool.size(), 1);
  mock.child.emit("close", 0);
  await new Promise((r) => setImmediate(r));
  assert.equal(pool.size(), 0);
});
