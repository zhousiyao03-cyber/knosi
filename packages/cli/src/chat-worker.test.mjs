import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Readable, Writable } from "node:stream";
import { ChatWorker } from "./chat-worker.mjs";

function makeMockChild() {
  const stdinChunks = [];
  const stdout = new Readable({ read() {} });
  const stderr = new Readable({ read() {} });
  const stdin = new Writable({
    write(chunk, _enc, cb) {
      stdinChunks.push(chunk.toString("utf8"));
      cb();
    },
  });
  const child = new EventEmitter();
  child.stdout = stdout;
  child.stderr = stderr;
  child.stdin = stdin;
  child.kill = () => child.emit("close", 0);
  return { child, stdinChunks, stdout };
}

test("ChatWorker emits text deltas and resolves with totalText + sessionId", async () => {
  const mock = makeMockChild();
  const worker = new ChatWorker({
    spawnFn: () => mock.child,
    workerKey: "u1|all|plain",
    systemPrompt: "S",
    model: "opus",
    cliSessionId: null,
    onSessionId: () => {},
    idleTimeoutMs: 60_000,
  });

  const deltas = [];
  const promise = worker.enqueue({
    userMessageContent: "hi",
    onText: (t) => deltas.push(t),
  });

  await new Promise((r) => setImmediate(r));

  mock.stdout.push(
    JSON.stringify({
      type: "system",
      subtype: "init",
      session_id: "sess-1",
    }) + "\n"
  );
  mock.stdout.push(
    JSON.stringify({
      type: "stream_event",
      event: {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "Hi " },
      },
    }) + "\n"
  );
  mock.stdout.push(
    JSON.stringify({
      type: "stream_event",
      event: {
        type: "content_block_delta",
        delta: { type: "text_delta", text: "there" },
      },
    }) + "\n"
  );
  mock.stdout.push(
    JSON.stringify({ type: "result", result: "Hi there" }) + "\n"
  );

  const out = await promise;
  assert.equal(out.totalText, "Hi there");
  assert.equal(out.sessionId, "sess-1");
  assert.deepEqual(deltas, ["Hi ", "there"]);

  worker.kill();
});

test("ChatWorker writes user message to stdin in stream-json format", async () => {
  const mock = makeMockChild();
  const worker = new ChatWorker({
    spawnFn: () => mock.child,
    workerKey: "u1|all|plain",
    systemPrompt: "S",
    model: "opus",
    cliSessionId: null,
    onSessionId: () => {},
    idleTimeoutMs: 60_000,
  });

  const promise = worker.enqueue({
    userMessageContent: "what is 2+2",
    onText: () => {},
  });

  await new Promise((r) => setImmediate(r));

  mock.stdout.push(
    JSON.stringify({
      type: "system",
      subtype: "init",
      session_id: "sx",
    }) + "\n"
  );
  mock.stdout.push(JSON.stringify({ type: "result", result: "4" }) + "\n");
  await promise;

  assert.ok(mock.stdinChunks.length >= 1);
  const parsed = JSON.parse(mock.stdinChunks[0].trim());
  assert.equal(parsed.type, "user");
  assert.equal(parsed.message.role, "user");
  assert.equal(parsed.message.content, "what is 2+2");

  worker.kill();
});

test("ChatWorker reports resumeMissed=true on RESUME_MISSING_PATTERN error", async () => {
  const mock = makeMockChild();
  const worker = new ChatWorker({
    spawnFn: () => mock.child,
    workerKey: "u1|all|plain",
    systemPrompt: "S",
    model: "opus",
    cliSessionId: "stale-id",
    onSessionId: () => {},
    idleTimeoutMs: 60_000,
  });

  const promise = worker.enqueue({
    userMessageContent: "hi",
    onText: () => {},
  });

  await new Promise((r) => setImmediate(r));

  mock.stdout.push(
    JSON.stringify({
      type: "result",
      is_error: true,
      result: "No conversation found with session ID: stale-id",
    }) + "\n"
  );

  let caught;
  try {
    await promise;
  } catch (e) {
    caught = e;
  }
  assert.ok(caught, "expected enqueue to reject");
  assert.equal(worker.resumeMissed(), true);

  worker.kill();
});

test("ChatWorker --resume flag is included in spawn args when cliSessionId is set", async () => {
  let capturedArgs = null;
  const mock = makeMockChild();
  const worker = new ChatWorker({
    spawnFn: (_bin, args) => {
      capturedArgs = args;
      return mock.child;
    },
    workerKey: "u1|all|plain",
    systemPrompt: "S",
    model: "opus",
    cliSessionId: "session-abc",
    onSessionId: () => {},
    idleTimeoutMs: 60_000,
  });
  void worker;

  assert.ok(capturedArgs);
  const idx = capturedArgs.indexOf("--resume");
  assert.notEqual(idx, -1, "--resume must be in args");
  assert.equal(capturedArgs[idx + 1], "session-abc");
  const inputFmtIdx = capturedArgs.indexOf("--input-format");
  assert.notEqual(inputFmtIdx, -1);
  assert.equal(capturedArgs[inputFmtIdx + 1], "stream-json");

  worker.kill();
});
